import type { DoseUnit, InventoryMovement, StockUnit } from './types';

export type UnitFamily = 'VOLUME' | 'MASS';

export const STOCK_UNITS: StockUnit[] = ['L', 'mL', 'kg', 'g'];
export const DOSE_UNITS: DoseUnit[] = ['L/ha', 'mL/ha', 'kg/ha', 'g/ha'];

export const STOCK_UNIT_FAMILY: Record<StockUnit, UnitFamily> = {
  L: 'VOLUME',
  mL: 'VOLUME',
  kg: 'MASS',
  g: 'MASS',
};

export const DOSE_UNIT_FAMILY: Record<DoseUnit, UnitFamily> = {
  'L/ha': 'VOLUME',
  'mL/ha': 'VOLUME',
  'kg/ha': 'MASS',
  'g/ha': 'MASS',
};

const STOCK_TO_BASE: Record<StockUnit, number> = {
  L: 1,
  mL: 0.001,
  kg: 1,
  g: 0.001,
};

const DOSE_TO_BASE: Record<DoseUnit, number> = {
  'L/ha': 1,
  'mL/ha': 0.001,
  'kg/ha': 1,
  'g/ha': 0.001,
};

export function unitsAreCompatible(from: StockUnit, to: StockUnit): boolean {
  return STOCK_UNIT_FAMILY[from] === STOCK_UNIT_FAMILY[to];
}

export function doseUnitsAreCompatible(from: DoseUnit, to: DoseUnit): boolean {
  return DOSE_UNIT_FAMILY[from] === DOSE_UNIT_FAMILY[to];
}

/** Converts between units of the same dimension only. Returns null for mass <-> volume. */
export function convertQuantity(quantity: number, from: StockUnit, to: StockUnit): number | null {
  if (!Number.isFinite(quantity)) return null;
  if (!unitsAreCompatible(from, to)) return null;
  const base = quantity * STOCK_TO_BASE[from];
  return roundQuantity(base / STOCK_TO_BASE[to]);
}

export function convertDose(quantity: number, from: DoseUnit, to: DoseUnit): number | null {
  if (!Number.isFinite(quantity)) return null;
  if (!doseUnitsAreCompatible(from, to)) return null;
  const base = quantity * DOSE_TO_BASE[from];
  return roundQuantity(base / DOSE_TO_BASE[to]);
}

export function roundQuantity(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function movementDirection(movement: InventoryMovement): 'IN' | 'OUT' {
  switch (movement.type) {
    case 'CONSUMPTION':
      return 'OUT';
    case 'ADJUSTMENT':
      return movement.adjustmentDirection === 'OUT' ? 'OUT' : 'IN';
    case 'OPENING_BALANCE':
    case 'RECEIPT':
    case 'RETURN':
    default:
      return 'IN';
  }
}

export function movementDelta(movement: InventoryMovement): number {
  if (movement.status === 'REVERSED') return 0;
  const signed = movementDirection(movement) === 'IN' ? movement.quantity : -movement.quantity;
  return signed;
}

export interface StockSummary {
  openingBalance: number;
  incoming: number;
  outgoing: number;
  adjustmentsIn: number;
  adjustmentsOut: number;
  balance: number;
  unit: StockUnit;
  movementCount: number;
}

export function summarizeStock(
  movements: InventoryMovement[],
  holdingId: string,
  productId: string,
  unit: StockUnit,
): StockSummary {
  const summary: StockSummary = {
    openingBalance: 0,
    incoming: 0,
    outgoing: 0,
    adjustmentsIn: 0,
    adjustmentsOut: 0,
    balance: 0,
    unit,
    movementCount: 0,
  };

  for (const movement of movements) {
    if (movement.status === 'REVERSED') continue;
    if (movement.holdingId !== holdingId || movement.productId !== productId) continue;
    const quantity = convertQuantity(movement.quantity, movement.unit, unit);
    if (quantity === null) continue;
    summary.movementCount += 1;
    if (movement.type === 'OPENING_BALANCE') summary.openingBalance += quantity;
    if (movement.type === 'RECEIPT' || movement.type === 'RETURN') summary.incoming += quantity;
    if (movement.type === 'CONSUMPTION') summary.outgoing += quantity;
    if (movement.type === 'ADJUSTMENT') {
      if (movementDirection(movement) === 'IN') summary.adjustmentsIn += quantity;
      else summary.adjustmentsOut += quantity;
    }
  }

  summary.balance = roundQuantity(
    summary.openingBalance +
      summary.incoming +
      summary.adjustmentsIn -
      summary.outgoing -
      summary.adjustmentsOut,
  );
  return summary;
}

export function currentStock(
  movements: InventoryMovement[],
  holdingId: string,
  productId: string,
  unit: StockUnit,
): number {
  return summarizeStock(movements, holdingId, productId, unit).balance;
}

export interface StockSequenceError {
  movementId: string;
  balance: number;
}

/**
 * Ensures that the chronological running balance never falls below zero.
 * `newMovement` is evaluated with the same chronological ordering rules.
 */
export function findNegativeStockPoint(
  movements: InventoryMovement[],
  productUnit: StockUnit,
  holdingId: string,
  productId: string,
): StockSequenceError | null {
  const relevant = movements
    .filter(
      (movement) =>
        movement.status === 'ACTIVE' &&
        movement.holdingId === holdingId &&
        movement.productId === productId,
    )
    .slice()
    .sort((a, b) => {
      const byDate = a.occurredAt.localeCompare(b.occurredAt);
      if (byDate !== 0) return byDate;
      return a.createdAt.localeCompare(b.createdAt);
    });

  let balance = 0;
  for (const movement of relevant) {
    const amount = convertQuantity(movement.quantity, movement.unit, productUnit);
    if (amount === null) continue;
    balance += movementDirection(movement) === 'IN' ? amount : -amount;
    if (balance < -0.000001) {
      return { movementId: movement.id, balance: roundQuantity(balance) };
    }
    balance = roundQuantity(balance);
  }
  return null;
}

export interface MovementValidationInput {
  quantity: number;
  unit: StockUnit;
  type: InventoryMovement['type'];
  adjustmentDirection?: 'IN' | 'OUT';
}

export type MovementValidationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'INVALID_QUANTITY'
        | 'MISSING_UNIT'
        | 'INVALID_ADJUSTMENT_DIRECTION'
        | 'INCOMPATIBLE_UNITS';
      unitFamily?: UnitFamily;
      productUnitFamily?: UnitFamily;
    };

export function validateMovementInput(
  input: MovementValidationInput,
  productUnit: StockUnit,
): MovementValidationResult {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { ok: false, code: 'INVALID_QUANTITY' };
  }
  if (!STOCK_UNITS.includes(input.unit)) {
    return { ok: false, code: 'MISSING_UNIT' };
  }
  if (input.type === 'ADJUSTMENT' && input.adjustmentDirection !== 'IN' && input.adjustmentDirection !== 'OUT') {
    return { ok: false, code: 'INVALID_ADJUSTMENT_DIRECTION' };
  }
  if (!unitsAreCompatible(input.unit, productUnit)) {
    return {
      ok: false,
      code: 'INCOMPATIBLE_UNITS',
      unitFamily: STOCK_UNIT_FAMILY[input.unit],
      productUnitFamily: STOCK_UNIT_FAMILY[productUnit],
    };
  }
  return { ok: true };
}

/**
 * Suggests the applied product quantity from a per-hectare dose over a treated area.
 * This is a unit calculation, not an agronomic recommendation.
 */
export function quantityFromDose(
  dose: number,
  doseUnit: DoseUnit,
  areaHa: number,
): { quantity: number; unit: StockUnit } | null {
  if (!Number.isFinite(dose) || dose <= 0 || !Number.isFinite(areaHa) || areaHa <= 0) return null;
  const quantity = roundQuantity(dose * areaHa);
  const unit = doseUnit.split('/')[0] as StockUnit;
  return { quantity, unit };
}

export function suggestedStockUnitForDoseUnit(doseUnit: DoseUnit): StockUnit {
  return doseUnit.split('/')[0] as StockUnit;
}
