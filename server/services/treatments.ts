import {
  convertQuantity,
  currentStock,
  findNegativeStockPoint,
  quantityFromDose,
  roundQuantity,
  STOCK_UNIT_FAMILY,
  DOSE_UNIT_FAMILY,
} from '../../src/domain/inventory';
import { makeId, nowIso } from '../../src/domain/ids';
import type {
  AuthContext,
  Database,
  InventoryMovement,
  PesticideProduct,
  ReferenceDoseStatus,
  TreatmentRecord,
} from '../../src/domain/types';
import type { TreatmentInput } from '../../src/domain/schemas';
import { ApiError } from '../http/errors';
import { appendAudit, type AuditActor } from './audit';
import { assertHoldingAccess } from './access';
import { syncAlerts } from './alerts';

export interface TreatmentResult {
  treatment: TreatmentRecord;
  warnings: string[];
}

interface ResolvedTreatmentContext {
  holdingName: string;
  cropName: string;
  product: PesticideProduct;
  quantityInStockUnit: number;
  referenceDoseStatus: ReferenceDoseStatus;
  warnings: string[];
}

function resolveContext(
  db: Database,
  auth: AuthContext,
  input: TreatmentInput,
): ResolvedTreatmentContext {
  const holding = db.holdings.find((item) => item.id === input.holdingId);
  if (!holding) throw new ApiError(404, 'HOLDING_NOT_FOUND', 'Agricultural holding was not found.');
  assertHoldingAccess(auth, holding);
  if (holding.status === 'ARCHIVED') {
    throw new ApiError(409, 'HOLDING_ARCHIVED', 'Treatments cannot be added to an archived holding.');
  }
  if (auth.role === 'FARMER' && holding.ownerFarmerId !== auth.farmerId) {
    throw new ApiError(403, 'OUT_OF_SCOPE', 'You can only record treatments for your own holding.');
  }
  if (auth.role === 'CHAMBER_ADMIN') {
    throw new ApiError(403, 'FORBIDDEN', 'Chamber administrators have read-only treatment access.');
  }

  const crop = db.crops.find((item) => item.id === input.cropId);
  if (!crop) throw new ApiError(404, 'CROP_NOT_FOUND', 'Crop record was not found.');
  if (crop.holdingId !== holding.id) {
    throw new ApiError(400, 'CROP_HOLDING_MISMATCH', 'The crop does not belong to the selected holding.');
  }
  if (crop.farmerId !== holding.ownerFarmerId) {
    throw new ApiError(409, 'DATA_INCONSISTENCY', 'The crop owner does not match the holding owner.');
  }
  const plot = db.plots.find((item) => item.id === input.plotId);
  if (!plot) throw new ApiError(404, 'PLOT_NOT_FOUND', 'Plot was not found.');
  if (plot.holdingId !== holding.id || crop.plotId !== plot.id) {
    throw new ApiError(400, 'PLOT_CROP_MISMATCH', 'The plot does not match the selected crop.');
  }
  const season = db.seasons.find((item) => item.id === input.seasonId);
  if (!season) throw new ApiError(404, 'SEASON_NOT_FOUND', 'Agricultural season was not found.');
  if (crop.seasonId !== season.id) {
    throw new ApiError(400, 'CROP_SEASON_MISMATCH', 'The crop belongs to a different agricultural season.');
  }

  const product = db.pesticides.find((item) => item.id === input.productId);
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Pesticide product was not found.');
  if (product.archived) {
    throw new ApiError(409, 'PRODUCT_ARCHIVED', 'This product is archived and cannot be used in new treatments.');
  }

  if (DOSE_UNIT_FAMILY[input.appliedDoseUnit] !== STOCK_UNIT_FAMILY[input.quantityUnit]) {
    throw new ApiError(
      400,
      'INCOMPATIBLE_APPLIED_QUANTITY',
      'The applied quantity unit is not compatible with the per-hectare dose unit.',
    );
  }

  const quantityInStockUnit = convertQuantity(
    input.quantityApplied,
    input.quantityUnit,
    product.stockUnit,
  );
  if (quantityInStockUnit === null) {
    throw new ApiError(
      400,
      'INCOMPATIBLE_UNITS',
      `The product stock is tracked in ${product.stockUnit}, which cannot be combined with ${input.quantityUnit}.`,
      { productUnit: product.stockUnit, quantityUnit: input.quantityUnit },
    );
  }

  const referenceDoseStatus: ReferenceDoseStatus = product.referenceDose
    ? product.verificationStatus === 'VERIFIED'
      ? 'VERIFIED'
      : 'DEMO'
    : 'MISSING';

  const warnings: string[] = [];
  if (input.treatedAreaHa > input.totalCropAreaHa + 0.0001) {
    warnings.push('TREATED_AREA_EXCEEDS_TOTAL');
  }
  if (Math.abs(input.totalCropAreaHa - crop.areaHa) > 0.01) {
    warnings.push('TOTAL_AREA_DIFFERS_FROM_CROP');
  }
  const suggested = quantityFromDose(input.appliedDose, input.appliedDoseUnit, input.treatedAreaHa);
  if (suggested) {
    const suggestedInStock = convertQuantity(suggested.quantity, suggested.unit, product.stockUnit);
    if (
      suggestedInStock !== null &&
      suggestedInStock > 0 &&
      Math.abs(suggestedInStock - quantityInStockUnit) / suggestedInStock > 0.15
    ) {
      warnings.push('QUANTITY_DIFFERS_FROM_DOSE_CALCULATION');
    }
  }
  if (referenceDoseStatus === 'MISSING') warnings.push('REFERENCE_DOSE_MISSING');
  if (referenceDoseStatus === 'DEMO') warnings.push('REFERENCE_DOSE_NOT_VERIFIED');

  return {
    holdingName: holding.name,
    cropName: crop.name,
    product,
    quantityInStockUnit,
    referenceDoseStatus,
    warnings,
  };
}

function buildConsumptionMovement(
  treatmentId: string,
  input: TreatmentInput,
  context: ResolvedTreatmentContext,
  holdingId: string,
  farmerId: string,
  actor: AuditActor,
): InventoryMovement {
  return {
    id: makeId('MOV'),
    holdingId,
    farmerId,
    productId: context.product.id,
    type: 'CONSUMPTION',
    occurredAt: input.treatmentDate,
    quantity: roundQuantity(context.quantityInStockUnit),
    unit: context.product.stockUnit,
    treatmentId,
    notes: `Automatic consumption for treatment ${treatmentId}`,
    createdBy: actor.id,
    createdAt: nowIso(),
    status: 'ACTIVE',
  };
}

function assertStockNonNegative(
  db: Database,
  movements: InventoryMovement[],
  product: PesticideProduct,
  holdingId: string,
  availableBefore: number,
): void {
  const negative = findNegativeStockPoint(movements, product.stockUnit, holdingId, product.id);
  if (negative) {
    throw new ApiError(
      409,
      'INSUFFICIENT_STOCK',
      'The applied quantity exceeds the calculated stock for this product and holding.',
      {
        available: roundQuantity(availableBefore),
        unit: product.stockUnit,
        movementId: negative.movementId,
      },
    );
  }
}

export function createTreatment(
  db: Database,
  auth: AuthContext,
  actor: AuditActor,
  input: TreatmentInput,
): TreatmentResult {
  const context = resolveContext(db, auth, input);
  const holding = db.holdings.find((item) => item.id === input.holdingId)!;
  const treatmentId = makeId('TRT');
  const movement = buildConsumptionMovement(
    treatmentId,
    input,
    context,
    holding.id,
    holding.ownerFarmerId,
    actor,
  );

  const availableBefore = currentStock(
    db.inventoryMovements,
    holding.id,
    context.product.id,
    context.product.stockUnit,
  );
  assertStockNonNegative(
    db,
    [...db.inventoryMovements, movement],
    context.product,
    holding.id,
    availableBefore,
  );

  const now = nowIso();
  const treatment: TreatmentRecord = {
    id: treatmentId,
    farmerId: holding.ownerFarmerId,
    holdingId: input.holdingId,
    plotId: input.plotId,
    cropId: input.cropId,
    seasonId: input.seasonId,
    treatmentDate: input.treatmentDate,
    productId: input.productId,
    activeIngredientSnapshot: context.product.activeIngredient,
    target: input.target,
    treatedAreaHa: roundQuantity(input.treatedAreaHa),
    totalCropAreaHa: roundQuantity(input.totalCropAreaHa),
    appliedDose: roundQuantity(input.appliedDose),
    appliedDoseUnit: input.appliedDoseUnit,
    referenceDose: context.product.referenceDose,
    referenceDoseUnit: context.product.referenceDoseUnit,
    referenceDoseStatus: context.referenceDoseStatus,
    referenceSource: context.product.referenceSource,
    quantityApplied: roundQuantity(input.quantityApplied),
    quantityUnit: input.quantityUnit,
    applicationMethod: input.applicationMethod || undefined,
    fieldConditions: input.fieldConditions || undefined,
    notes: input.notes || undefined,
    sourceInfo: input.sourceInfo || undefined,
    consumptionMovementId: movement.id,
    status: 'ACTIVE',
    revision: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
  };

  db.inventoryMovements.push(movement);
  db.treatments.push(treatment);
  appendAudit(
    db,
    actor,
    'TREATMENT_CREATED',
    'treatment',
    treatment.id,
    `Treatment recorded for ${context.cropName} at ${context.holdingName} using ${context.product.commercialName}.`,
    {
      holdingId: treatment.holdingId,
      cropId: treatment.cropId,
      productId: treatment.productId,
      quantity: movement.quantity,
      unit: movement.unit,
    },
  );
  syncAlerts(db);
  return { treatment, warnings: context.warnings };
}

export function updateTreatment(
  db: Database,
  auth: AuthContext,
  actor: AuditActor,
  treatmentId: string,
  input: TreatmentInput,
): TreatmentResult {
  const existing = db.treatments.find((item) => item.id === treatmentId);
  if (!existing) throw new ApiError(404, 'TREATMENT_NOT_FOUND', 'Treatment record was not found.');
  if (existing.status === 'REVERSED') {
    throw new ApiError(409, 'TREATMENT_REVERSED', 'A reversed treatment cannot be edited.');
  }
  if (existing.holdingId !== input.holdingId) {
    throw new ApiError(
      400,
      'TREATMENT_HOLDING_IMMUTABLE',
      'The holding of an existing treatment cannot be changed. Reverse it and create a new record instead.',
    );
  }
  const context = resolveContext(db, auth, input);
  const holding = db.holdings.find((item) => item.id === input.holdingId)!;
  const now = nowIso();
  const revision = existing.revision + 1;

  const activeLinked = db.inventoryMovements.filter(
    (movement) =>
      movement.treatmentId === existing.id &&
      movement.status === 'ACTIVE' &&
      movement.type === 'CONSUMPTION',
  );
  const reversedMovements = db.inventoryMovements.map((movement) =>
    activeLinked.some((linked) => linked.id === movement.id)
      ? {
          ...movement,
          status: 'REVERSED' as const,
          reversedAt: now,
          reversedBy: actor.id,
          reversalReason: `Superseded by treatment revision ${revision}`,
        }
      : movement,
  );

  const availableBefore = currentStock(
    reversedMovements,
    holding.id,
    context.product.id,
    context.product.stockUnit,
  );
  const newMovement = buildConsumptionMovement(
    existing.id,
    input,
    context,
    holding.id,
    holding.ownerFarmerId,
    actor,
  );
  const nextMovements = [...reversedMovements, newMovement];
  assertStockNonNegative(
    db,
    nextMovements,
    context.product,
    holding.id,
    availableBefore,
  );

  db.inventoryMovements = nextMovements;
  Object.assign(existing, {
    plotId: input.plotId,
    cropId: input.cropId,
    seasonId: input.seasonId,
    treatmentDate: input.treatmentDate,
    productId: input.productId,
    activeIngredientSnapshot: context.product.activeIngredient,
    target: input.target,
    treatedAreaHa: roundQuantity(input.treatedAreaHa),
    totalCropAreaHa: roundQuantity(input.totalCropAreaHa),
    appliedDose: roundQuantity(input.appliedDose),
    appliedDoseUnit: input.appliedDoseUnit,
    referenceDose: context.product.referenceDose,
    referenceDoseUnit: context.product.referenceDoseUnit,
    referenceDoseStatus: context.referenceDoseStatus,
    referenceSource: context.product.referenceSource,
    quantityApplied: roundQuantity(input.quantityApplied),
    quantityUnit: input.quantityUnit,
    applicationMethod: input.applicationMethod || undefined,
    fieldConditions: input.fieldConditions || undefined,
    notes: input.notes || undefined,
    sourceInfo: input.sourceInfo || undefined,
    consumptionMovementId: newMovement.id,
    updatedAt: now,
    updatedBy: actor.id,
    revision,
  });

  appendAudit(
    db,
    actor,
    'TREATMENT_UPDATED',
    'treatment',
    existing.id,
    `Treatment revision ${revision} saved for ${context.cropName} using ${context.product.commercialName}. Previous inventory consumption was reversed.`,
    {
      holdingId: existing.holdingId,
      productId: existing.productId,
      revision,
      quantity: newMovement.quantity,
      unit: newMovement.unit,
    },
  );
  syncAlerts(db);
  return { treatment: existing, warnings: context.warnings };
}

export function reverseTreatment(
  db: Database,
  auth: AuthContext,
  actor: AuditActor,
  treatmentId: string,
  reason: string,
): TreatmentRecord {
  const treatment = db.treatments.find((item) => item.id === treatmentId);
  if (!treatment) throw new ApiError(404, 'TREATMENT_NOT_FOUND', 'Treatment record was not found.');
  const holding = db.holdings.find((item) => item.id === treatment.holdingId);
  if (!holding) throw new ApiError(404, 'HOLDING_NOT_FOUND', 'Agricultural holding was not found.');
  assertHoldingAccess(auth, holding);
  if (auth.role === 'FARMER' && treatment.farmerId !== auth.farmerId) {
    throw new ApiError(403, 'OUT_OF_SCOPE', 'You can only reverse your own treatments.');
  }
  if (auth.role === 'CHAMBER_ADMIN') {
    throw new ApiError(403, 'FORBIDDEN', 'Chamber administrators have read-only treatment access.');
  }
  if (treatment.status === 'REVERSED') {
    throw new ApiError(409, 'TREATMENT_ALREADY_REVERSED', 'This treatment is already reversed.');
  }

  const now = nowIso();
  for (const movement of db.inventoryMovements) {
    if (
      movement.treatmentId === treatment.id &&
      movement.status === 'ACTIVE' &&
      movement.type === 'CONSUMPTION'
    ) {
      movement.status = 'REVERSED';
      movement.reversedAt = now;
      movement.reversedBy = actor.id;
      movement.reversalReason = `Treatment reversed: ${reason}`;
    }
  }

  treatment.status = 'REVERSED';
  treatment.reversedAt = now;
  treatment.reversedBy = actor.id;
  treatment.reversalReason = reason;
  treatment.updatedAt = now;
  treatment.updatedBy = actor.id;

  appendAudit(
    db,
    actor,
    'TREATMENT_REVERSED',
    'treatment',
    treatment.id,
    `Treatment reversed. Inventory consumption restored. Reason: ${reason}`,
    { holdingId: treatment.holdingId, productId: treatment.productId, reason },
  );
  syncAlerts(db);
  return treatment;
}
