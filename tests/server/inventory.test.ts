import { describe, expect, it } from 'vitest';
import {
  createInventoryMovement,
  reverseInventoryMovement,
} from '../../server/services/inventory';
import { ApiError } from '../../server/http/errors';
import type { MovementInput } from '../../src/domain/schemas';
import { currentStock } from '../../src/domain/inventory';
import { actorFor, authFor, makeDatabase } from '../fixtures';

function movementInput(overrides: Partial<MovementInput> = {}): MovementInput {
  return {
    holdingId: 'HLD-001',
    productId: 'PRD-VOL',
    type: 'RECEIPT',
    occurredAt: '2026-03-01',
    quantity: 5,
    unit: 'L',
    supplierOrReference: 'Local cooperative',
    notes: 'Test receipt',
    ...overrides,
  };
}

function expectApiError(fn: () => unknown, code: string, status?: number): ApiError {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ApiError);
  const apiError = caught as ApiError;
  expect(apiError.code).toBe(code);
  if (status !== undefined) expect(apiError.status).toBe(status);
  return apiError;
}

describe('inventory movements', () => {
  it('records a receipt and recalculates the balance from movements only', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-DSA-001');
    const actor = actorFor(db, 'U-DSA-001');
    const { movement } = createInventoryMovement(db, auth, actor, movementInput());

    expect(movement.type).toBe('RECEIPT');
    expect(movement.status).toBe('ACTIVE');
    expect(movement.createdBy).toBe('U-DSA-001');
    expect(currentStock(db.inventoryMovements, 'HLD-001', 'PRD-VOL', 'L')).toBe(25);
    expect(db.auditLog.at(-1)).toMatchObject({
      action: 'INVENTORY_RECEIPT',
      entityType: 'inventoryMovement',
      entityId: movement.id,
      metadata: { quantity: 5, unit: 'L' },
    });
  });

  it('rejects movements that would make the chronological stock negative', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-DSA-001');
    const actor = actorFor(db, 'U-DSA-001');
    const error = expectApiError(
      () => createInventoryMovement(db, auth, actor, movementInput({ type: 'ADJUSTMENT', adjustmentDirection: 'OUT', quantity: 25 })),
      'INSUFFICIENT_STOCK',
      409,
    );
    expect(error.details).toMatchObject({ available: 20, unit: 'L' });
    expect(currentStock(db.inventoryMovements, 'HLD-001', 'PRD-VOL', 'L')).toBe(20);
    expect(db.inventoryMovements).toHaveLength(3);
  });

  it('never accepts a manual consumption movement', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-DSA-001');
    expectApiError(
      () => createInventoryMovement(db, auth, actorFor(db, 'U-DSA-001'), movementInput({ type: 'CONSUMPTION' })),
      'USE_TREATMENT_SERVICE',
      400,
    );
  });

  it('rejects incompatible units and invalid adjustments', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-DSA-001');
    const actor = actorFor(db, 'U-DSA-001');
    expectApiError(
      () => createInventoryMovement(db, auth, actor, movementInput({ unit: 'kg' })),
      'INCOMPATIBLE_UNITS',
      400,
    );
    expectApiError(
      () => createInventoryMovement(db, auth, actor, movementInput({ type: 'ADJUSTMENT' })),
      'INVALID_ADJUSTMENT_DIRECTION',
      400,
    );
    expectApiError(
      () => createInventoryMovement(db, auth, actor, movementInput({ quantity: 0 })),
      'INVALID_QUANTITY',
      400,
    );
  });

  it('enforces read-only Chamber access and farmer ownership', () => {
    const db = makeDatabase();
    const chamber = authFor(db, 'U-CHM-001');
    expectApiError(
      () => createInventoryMovement(db, chamber, actorFor(db, 'U-CHM-001'), movementInput()),
      'FORBIDDEN',
      403,
    );

    const otherFarmer = authFor(db, 'U-FRM-001');
    const error = expectApiError(
      () => createInventoryMovement(db, otherFarmer, actorFor(db, 'U-FRM-001'), movementInput({ holdingId: 'HLD-002' })),
      'OUT_OF_SCOPE',
      403,
    );
    expect(error.status).toBe(403);

    const farmer = authFor(db, 'U-FRM-001');
    const { movement } = createInventoryMovement(db, farmer, actorFor(db, 'U-FRM-001'), movementInput({ quantity: 2 }));
    expect(movement.farmerId).toBe('FRM-001');
  });

  it('blocks movements for archived holdings or products', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-DSA-001');
    const actor = actorFor(db, 'U-DSA-001');
    db.holdings[0]!.status = 'ARCHIVED';
    expectApiError(() => createInventoryMovement(db, auth, actor, movementInput()), 'HOLDING_ARCHIVED', 409);
    db.holdings[0]!.status = 'ACTIVE';
    db.pesticides[0]!.archived = true;
    expectApiError(() => createInventoryMovement(db, auth, actor, movementInput()), 'PRODUCT_ARCHIVED', 409);
  });

  it('reverses a movement with a reason, excluding it from the balance', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-DSA-001');
    const actor = actorFor(db, 'U-DSA-001');
    const { movement } = createInventoryMovement(db, auth, actor, movementInput());
    const reversed = reverseInventoryMovement(db, auth, actor, movement.id, 'Duplicate delivery entry');

    expect(reversed.status).toBe('REVERSED');
    expect(reversed.reversalReason).toBe('Duplicate delivery entry');
    expect(currentStock(db.inventoryMovements, 'HLD-001', 'PRD-VOL', 'L')).toBe(20);
    expect(db.auditLog.at(-1)?.action).toBe('INVENTORY_MOVEMENT_REVERSED');
    expectApiError(
      () => reverseInventoryMovement(db, auth, actor, movement.id, 'again'),
      'ALREADY_REVERSED',
      409,
    );
  });

  it('refuses a reversal that later records depend on', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-DSA-001');
    const actor = actorFor(db, 'U-DSA-001');
    const { movement } = createInventoryMovement(db, auth, actor, movementInput({ quantity: 5 }));
    createInventoryMovement(
      db,
      auth,
      actor,
      movementInput({ type: 'ADJUSTMENT', adjustmentDirection: 'OUT', quantity: 24, occurredAt: '2026-03-02' }),
    );
    expectApiError(
      () => reverseInventoryMovement(db, auth, actor, movement.id, 'Would break later consumption'),
      'NEGATIVE_STOCK_ON_REVERSAL',
      409,
    );
  });
});
