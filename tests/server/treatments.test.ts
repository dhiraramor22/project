import { describe, expect, it } from 'vitest';
import {
  createTreatment,
  reverseTreatment,
  updateTreatment,
} from '../../server/services/treatments';
import { ApiError } from '../../server/http/errors';
import { currentStock } from '../../src/domain/inventory';
import type { TreatmentInput } from '../../src/domain/schemas';
import { actorFor, authFor, makeDatabase } from '../fixtures';

function treatmentInput(overrides: Partial<TreatmentInput> = {}): TreatmentInput {
  return {
    holdingId: 'HLD-001',
    plotId: 'PLT-001',
    cropId: 'CRP-001',
    seasonId: 'SSN-2026',
    treatmentDate: '2026-03-10',
    productId: 'PRD-VOL',
    target: 'Test pest',
    treatedAreaHa: 1,
    totalCropAreaHa: 2,
    appliedDose: 2,
    appliedDoseUnit: 'L/ha',
    quantityApplied: 2,
    quantityUnit: 'L',
    applicationMethod: 'Backpack sprayer',
    notes: 'Test treatment',
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

const stock = (db: ReturnType<typeof makeDatabase>) =>
  currentStock(db.inventoryMovements, 'HLD-001', 'PRD-VOL', 'L');

describe('treatment register and linked inventory', () => {
  it('creates a treatment and deducts its consumption exactly once', () => {
    const db = makeDatabase();
    const { treatment, warnings } = createTreatment(
      db,
      authFor(db, 'U-DSA-001'),
      actorFor(db, 'U-DSA-001'),
      treatmentInput(),
    );

    expect(treatment.status).toBe('ACTIVE');
    expect(treatment.revision).toBe(1);
    expect(treatment.referenceDose).toBe(2);
    expect(treatment.referenceDoseStatus).toBe('VERIFIED');
    expect(treatment.consumptionMovementId).toBeDefined();
    expect(warnings).toEqual([]);
    expect(stock(db)).toBe(18);

    const linked = db.inventoryMovements.filter((item) => item.treatmentId === treatment.id);
    expect(linked).toHaveLength(1);
    expect(linked[0]).toMatchObject({
      type: 'CONSUMPTION',
      quantity: 2,
      unit: 'L',
      status: 'ACTIVE',
      id: treatment.consumptionMovementId,
    });
    expect(db.auditLog.at(-1)).toMatchObject({ action: 'TREATMENT_CREATED', entityId: treatment.id });
  });

  it('edits without double-deducting by reversing the old consumption first', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-DSA-001');
    const actor = actorFor(db, 'U-DSA-001');
    const { treatment } = createTreatment(db, auth, actor, treatmentInput());
    const originalMovementId = treatment.consumptionMovementId;

    const updated = updateTreatment(
      db,
      auth,
      actor,
      treatment.id,
      treatmentInput({ appliedDose: 3, quantityApplied: 3, treatedAreaHa: 1.5 }),
    );

    expect(stock(db)).toBe(17);
    expect(updated.treatment.revision).toBe(2);
    expect(updated.treatment.quantityApplied).toBe(3);
    expect(updated.treatment.consumptionMovementId).not.toBe(originalMovementId);

    const linked = db.inventoryMovements.filter((item) => item.treatmentId === treatment.id);
    expect(linked).toHaveLength(2);
    expect(linked.filter((item) => item.status === 'ACTIVE')).toHaveLength(1);
    expect(linked.filter((item) => item.status === 'REVERSED')).toHaveLength(1);
    expect(linked.find((item) => item.status === 'ACTIVE')?.quantity).toBe(3);
    expect(linked.find((item) => item.id === originalMovementId)?.reversalReason).toContain('revision 2');
    expect(db.auditLog.at(-1)?.action).toBe('TREATMENT_UPDATED');
  });

  it('reverses a treatment and restores the linked inventory', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-DSA-001');
    const actor = actorFor(db, 'U-DSA-001');
    const { treatment } = createTreatment(db, auth, actor, treatmentInput());
    expect(stock(db)).toBe(18);

    const reversed = reverseTreatment(db, auth, actor, treatment.id, 'Recorded against the wrong plot');
    expect(reversed.status).toBe('REVERSED');
    expect(reversed.reversalReason).toBe('Recorded against the wrong plot');
    expect(stock(db)).toBe(20);
    expect(
      db.inventoryMovements
        .filter((item) => item.treatmentId === treatment.id)
        .every((item) => item.status === 'REVERSED'),
    ).toBe(true);
    expect(db.auditLog.at(-1)?.action).toBe('TREATMENT_REVERSED');
    expectApiError(
      () => reverseTreatment(db, auth, actor, treatment.id, 'twice'),
      'TREATMENT_ALREADY_REVERSED',
      409,
    );
  });

  it('refuses to edit a reversed treatment', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-DSA-001');
    const actor = actorFor(db, 'U-DSA-001');
    const { treatment } = createTreatment(db, auth, actor, treatmentInput());
    reverseTreatment(db, auth, actor, treatment.id, 'Mistake');
    expectApiError(() => updateTreatment(db, auth, actor, treatment.id, treatmentInput()), 'TREATMENT_REVERSED', 409);
  });

  it('rejects treatment quantities that exceed available stock', () => {
    const db = makeDatabase();
    const error = expectApiError(
      () =>
        createTreatment(
          db,
          authFor(db, 'U-DSA-001'),
          actorFor(db, 'U-DSA-001'),
          treatmentInput({ quantityApplied: 30 }),
        ),
      'INSUFFICIENT_STOCK',
      409,
    );
    expect(error.details).toMatchObject({ available: 20, unit: 'L' });
    expect(db.treatments).toHaveLength(0);
    expect(stock(db)).toBe(20);
  });

  it('does not allow mass and volume units inside one treatment', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-DSA-001');
    const actor = actorFor(db, 'U-DSA-001');
    expectApiError(
      () => createTreatment(db, auth, actor, treatmentInput({ quantityUnit: 'kg' })),
      'INCOMPATIBLE_APPLIED_QUANTITY',
      400,
    );
    expectApiError(
      () => createTreatment(db, auth, actor, treatmentInput({ productId: 'PRD-MASS', quantityUnit: 'kg', appliedDoseUnit: 'kg/ha', appliedDose: 1.5, quantityApplied: 1.5 })),
      'INSUFFICIENT_STOCK',
      409,
    );
  });

  it('enforces Chamber read-only access, farmer ownership and immutable holdings', () => {
    const db = makeDatabase();
    expectApiError(
      () => createTreatment(db, authFor(db, 'U-CHM-001'), actorFor(db, 'U-CHM-001'), treatmentInput()),
      'FORBIDDEN',
      403,
    );
    expectApiError(
      () =>
        createTreatment(
          db,
          authFor(db, 'U-FRM-002'),
          actorFor(db, 'U-FRM-002'),
          treatmentInput(),
        ),
      'OUT_OF_SCOPE',
      403,
    );

    const auth = authFor(db, 'U-DSA-001');
    const actor = actorFor(db, 'U-DSA-001');
    const { treatment } = createTreatment(db, auth, actor, treatmentInput());
    expectApiError(
      () =>
        updateTreatment(
          db,
          auth,
          actor,
          treatment.id,
          treatmentInput({ holdingId: 'HLD-002', plotId: 'PLT-002', cropId: 'CRP-002' }),
        ),
      'TREATMENT_HOLDING_IMMUTABLE',
      400,
    );
  });

  it('refuses archived products and mismatched crops/plots', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-DSA-001');
    const actor = actorFor(db, 'U-DSA-001');
    db.pesticides[0]!.archived = true;
    expectApiError(() => createTreatment(db, auth, actor, treatmentInput()), 'PRODUCT_ARCHIVED', 409);
    db.pesticides[0]!.archived = false;
    expectApiError(
      () => createTreatment(db, auth, actor, treatmentInput({ plotId: 'PLT-002' })),
      'PLOT_CROP_MISMATCH',
      400,
    );
  });

  it('returns warnings for inconsistent area fields while still recording the treatment', () => {
    const db = makeDatabase();
    const { treatment, warnings } = createTreatment(
      db,
      authFor(db, 'U-DSA-001'),
      actorFor(db, 'U-DSA-001'),
      treatmentInput({ treatedAreaHa: 3, totalCropAreaHa: 2, quantityApplied: 6, appliedDose: 2 }),
    );
    expect(warnings).toContain('TREATED_AREA_EXCEEDS_TOTAL');
    expect(treatment.treatedAreaHa).toBe(3);
    expect(db.alerts.some((alert) => alert.entityId === treatment.id && alert.category === 'AREA_MISMATCH')).toBe(true);
  });
});
