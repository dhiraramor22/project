import { describe, expect, it } from 'vitest';
import {
  convertDose,
  convertQuantity,
  currentStock,
  doseUnitsAreCompatible,
  findNegativeStockPoint,
  movementDelta,
  quantityFromDose,
  summarizeStock,
  unitsAreCompatible,
  validateMovementInput,
} from '../../src/domain/inventory';
import type { InventoryMovement } from '../../src/domain/types';
import { makeDatabase } from '../fixtures';

const movement = (overrides: Partial<InventoryMovement>): InventoryMovement => ({
  id: 'MOV-T',
  holdingId: 'HLD-001',
  farmerId: 'FRM-001',
  productId: 'PRD-VOL',
  type: 'RECEIPT',
  occurredAt: '2026-02-01',
  quantity: 1,
  unit: 'L',
  createdBy: 'U-DSA-001',
  createdAt: '2026-02-01T00:00:00.000Z',
  status: 'ACTIVE',
  ...overrides,
});

describe('inventory unit handling', () => {
  it('converts within the same dimension only', () => {
    expect(convertQuantity(1, 'L', 'mL')).toBe(1000);
    expect(convertQuantity(2500, 'mL', 'L')).toBe(2.5);
    expect(convertQuantity(1.5, 'kg', 'g')).toBe(1500);
    expect(convertQuantity(1, 'L', 'kg')).toBeNull();
    expect(unitsAreCompatible('L', 'mL')).toBe(true);
    expect(unitsAreCompatible('kg', 'L')).toBe(false);
    expect(doseUnitsAreCompatible('g/ha', 'kg/ha')).toBe(true);
    expect(doseUnitsAreCompatible('L/ha', 'kg/ha')).toBe(false);
    expect(convertDose(1, 'L/ha', 'mL/ha')).toBe(1000);
    expect(convertDose(1, 'L/ha', 'kg/ha')).toBeNull();
  });

  it('derives the applied quantity from a dose without inventing an agronomic recommendation', () => {
    expect(quantityFromDose(2.5, 'L/ha', 1.2)).toEqual({ quantity: 3, unit: 'L' });
    expect(quantityFromDose(300, 'mL/ha', 0.5)).toEqual({ quantity: 150, unit: 'mL' });
    expect(quantityFromDose(0, 'L/ha', 1)).toBeNull();
    expect(quantityFromDose(2, 'L/ha', 0)).toBeNull();
  });
});

describe('stock ledger', () => {
  it('computes balances from movements, including compatible unit conversion', () => {
    const db = makeDatabase();
    const summary = summarizeStock(db.inventoryMovements, 'HLD-001', 'PRD-VOL', 'L');
    expect(summary.balance).toBe(20);
    expect(summary.openingBalance).toBe(20);
    expect(summary.movementCount).toBe(1);

    const mixed = [
      movement({ id: 'M1', type: 'OPENING_BALANCE', quantity: 5, unit: 'L', occurredAt: '2026-01-01' }),
      movement({ id: 'M2', type: 'RECEIPT', quantity: 1500, unit: 'mL', occurredAt: '2026-01-02' }),
      movement({ id: 'M3', type: 'CONSUMPTION', quantity: 0.5, unit: 'L', occurredAt: '2026-01-03' }),
      movement({ id: 'M4', type: 'ADJUSTMENT', adjustmentDirection: 'OUT', quantity: 250, unit: 'mL', occurredAt: '2026-01-04' }),
      movement({ id: 'M5', type: 'ADJUSTMENT', adjustmentDirection: 'IN', quantity: 0.25, unit: 'L', occurredAt: '2026-01-05' }),
      movement({ id: 'M6', type: 'RETURN', quantity: 100, unit: 'mL', occurredAt: '2026-01-06' }),
    ];
    const mixedSummary = summarizeStock(mixed, 'HLD-001', 'PRD-VOL', 'L');
    expect(mixedSummary.balance).toBe(6.1);
    expect(mixedSummary.incoming).toBe(1.6);
    expect(mixedSummary.outgoing).toBe(0.5);
    expect(mixedSummary.adjustmentsIn).toBe(0.25);
    expect(mixedSummary.adjustmentsOut).toBe(0.25);
    expect(currentStock(mixed, 'HLD-001', 'PRD-VOL', 'L')).toBe(6.1);
  });

  it('ignores reversed movements and incompatible units', () => {
    const movements = [
      movement({ id: 'M1', type: 'OPENING_BALANCE', quantity: 4 }),
      movement({ id: 'M2', type: 'RECEIPT', quantity: 2, status: 'REVERSED' }),
      movement({ id: 'M3', type: 'RECEIPT', quantity: 2, unit: 'kg' }),
    ];
    expect(currentStock(movements, 'HLD-001', 'PRD-VOL', 'L')).toBe(4);
    expect(movementDelta(movements[0]!)).toBe(4);
    expect(movementDelta(movements[1]!)).toBe(0);
  });

  it('detects the first negative point in chronological order', () => {
    const db = makeDatabase();
    const sequence = [
      ...db.inventoryMovements.filter((item) => item.productId === 'PRD-VOL' && item.holdingId === 'HLD-001'),
      movement({
        id: 'MOV-LATE',
        type: 'CONSUMPTION',
        quantity: 25,
        occurredAt: '2026-02-01',
      }),
    ];
    const negative = findNegativeStockPoint(sequence, 'L', 'HLD-001', 'PRD-VOL');
    expect(negative).not.toBeNull();
    expect(negative?.movementId).toBe('MOV-LATE');
    expect(negative?.balance).toBe(-5);
  });

  it('rejects invalid movement input before it reaches the ledger', () => {
    expect(validateMovementInput({ quantity: 0, unit: 'L', type: 'RECEIPT' }, 'L')).toEqual({
      ok: false,
      code: 'INVALID_QUANTITY',
    });
    expect(validateMovementInput({ quantity: 1, unit: 'L', type: 'ADJUSTMENT' }, 'L')).toMatchObject({
      ok: false,
      code: 'INVALID_ADJUSTMENT_DIRECTION',
    });
    expect(validateMovementInput({ quantity: 1, unit: 'kg', type: 'RECEIPT' }, 'L')).toMatchObject({
      ok: false,
      code: 'INCOMPATIBLE_UNITS',
      unitFamily: 'MASS',
      productUnitFamily: 'VOLUME',
    });
    expect(
      validateMovementInput({ quantity: 1, unit: 'L', type: 'ADJUSTMENT', adjustmentDirection: 'OUT' }, 'L'),
    ).toEqual({ ok: true });
  });
});
