import {
  currentStock,
  findNegativeStockPoint,
  roundQuantity,
  validateMovementInput,
} from '../../src/domain/inventory';
import { makeId, nowIso } from '../../src/domain/ids';
import type { AuthContext, Database, InventoryMovement } from '../../src/domain/types';
import type { MovementInput as MovementInputType } from '../../src/domain/schemas';
import { ApiError } from '../http/errors';
import { appendAudit, type AuditActor } from './audit';
import { assertHoldingAccess } from './access';
import { syncAlerts } from './alerts';

export interface MovementResult {
  movement: InventoryMovement;
  warnings: string[];
}

export function createInventoryMovement(
  db: Database,
  auth: AuthContext,
  actor: AuditActor,
  input: MovementInputType,
): MovementResult {
  const holding = db.holdings.find((item) => item.id === input.holdingId);
  if (!holding) throw new ApiError(404, 'HOLDING_NOT_FOUND', 'Agricultural holding was not found.');
  assertHoldingAccess(auth, holding);
  if (holding.status === 'ARCHIVED') {
    throw new ApiError(409, 'HOLDING_ARCHIVED', 'Movements cannot be added to an archived holding.');
  }
  if (auth.role === 'FARMER' && holding.ownerFarmerId !== auth.farmerId) {
    throw new ApiError(403, 'OUT_OF_SCOPE', 'You can only add movements to your own holding.');
  }
  if (auth.role === 'CHAMBER_ADMIN') {
    throw new ApiError(403, 'FORBIDDEN', 'Chamber administrators have read-only inventory access.');
  }

  const product = db.pesticides.find((item) => item.id === input.productId);
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Pesticide product was not found.');
  if (product.archived) {
    throw new ApiError(409, 'PRODUCT_ARCHIVED', 'Movements cannot be recorded for an archived product.');
  }
  if (input.type === 'CONSUMPTION') {
    throw new ApiError(
      400,
      'USE_TREATMENT_SERVICE',
      'Treatment consumption must be recorded through the treatment register to preserve the inventory link.',
    );
  }

  const validation = validateMovementInput(input, product.stockUnit);
  if (!validation.ok) {
    throw new ApiError(400, validation.code, 'The movement quantity or unit is not valid for this product.', {
      validation,
      productUnit: product.stockUnit,
    });
  }

  const now = nowIso();
  const movement: InventoryMovement = {
    id: makeId('MOV'),
    holdingId: holding.id,
    farmerId: holding.ownerFarmerId,
    productId: product.id,
    type: input.type,
    occurredAt: input.occurredAt,
    quantity: roundQuantity(input.quantity),
    unit: input.unit,
    adjustmentDirection: input.type === 'ADJUSTMENT' ? input.adjustmentDirection : undefined,
    supplierOrReference: input.supplierOrReference || undefined,
    notes: input.notes || undefined,
    createdBy: actor.id,
    createdAt: now,
    status: 'ACTIVE',
  };

  const nextMovements = [...db.inventoryMovements, movement];
  const negative = findNegativeStockPoint(
    nextMovements,
    product.stockUnit,
    holding.id,
    product.id,
  );
  if (negative) {
    const available = currentStock(
      db.inventoryMovements,
      holding.id,
      product.id,
      product.stockUnit,
    );
    throw new ApiError(
      409,
      'INSUFFICIENT_STOCK',
      'This movement would make the calculated stock negative.',
      { available, unit: product.stockUnit, movementId: negative.movementId },
    );
  }

  db.inventoryMovements.push(movement);
  appendAudit(
    db,
    actor,
    `INVENTORY_${input.type}`,
    'inventoryMovement',
    movement.id,
    `${input.type} of ${movement.quantity} ${movement.unit} for ${product.commercialName} at ${holding.name}.`,
    {
      holdingId: holding.id,
      productId: product.id,
      quantity: movement.quantity,
      unit: movement.unit,
      type: movement.type,
    },
  );
  syncAlerts(db);

  return { movement, warnings: [] };
}

export function reverseInventoryMovement(
  db: Database,
  auth: AuthContext,
  actor: AuditActor,
  movementId: string,
  reason: string,
): InventoryMovement {
  const movement = db.inventoryMovements.find((item) => item.id === movementId);
  if (!movement) throw new ApiError(404, 'MOVEMENT_NOT_FOUND', 'Inventory movement was not found.');
  const holding = db.holdings.find((item) => item.id === movement.holdingId);
  if (!holding) throw new ApiError(404, 'HOLDING_NOT_FOUND', 'Agricultural holding was not found.');
  assertHoldingAccess(auth, holding);
  if (auth.role === 'CHAMBER_ADMIN') {
    throw new ApiError(403, 'FORBIDDEN', 'Chamber administrators have read-only inventory access.');
  }
  if (auth.role === 'FARMER' && holding.ownerFarmerId !== auth.farmerId) {
    throw new ApiError(403, 'OUT_OF_SCOPE', 'You can only correct your own inventory movements.');
  }
  if (movement.status === 'REVERSED') {
    throw new ApiError(409, 'ALREADY_REVERSED', 'This inventory movement is already reversed.');
  }
  if (movement.treatmentId) {
    throw new ApiError(
      409,
      'LINKED_TO_TREATMENT',
      'This movement belongs to a treatment. Reverse the treatment instead.',
    );
  }
  const product = db.pesticides.find((item) => item.id === movement.productId);
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Pesticide product was not found.');

  const now = nowIso();
  const nextMovements = db.inventoryMovements.map((item) =>
    item.id === movement.id
      ? {
          ...item,
          status: 'REVERSED' as const,
          reversedAt: now,
          reversedBy: actor.id,
          reversalReason: reason,
        }
      : item,
  );
  const negative = findNegativeStockPoint(
    nextMovements,
    product.stockUnit,
    movement.holdingId,
    movement.productId,
  );
  if (negative) {
    throw new ApiError(
      409,
      'NEGATIVE_STOCK_ON_REVERSAL',
      'This reversal would make the calculated stock negative because later movements depend on it.',
      { movementId: negative.movementId },
    );
  }

  Object.assign(movement, nextMovements.find((item) => item.id === movement.id));
  appendAudit(
    db,
    actor,
    'INVENTORY_MOVEMENT_REVERSED',
    'inventoryMovement',
    movement.id,
    `Reversed ${movement.type} of ${movement.quantity} ${movement.unit} for ${product.commercialName}. Reason: ${reason}`,
    { holdingId: movement.holdingId, productId: movement.productId, reason },
  );
  syncAlerts(db);
  return movement;
}
