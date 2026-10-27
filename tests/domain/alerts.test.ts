import { describe, expect, it } from 'vitest';
import { deriveAlertCandidates, mergeAlerts } from '../../src/domain/alerts';
import { makeDatabase, makeTreatment, FIXTURE_NOW } from '../fixtures';

function derive(input: ReturnType<typeof makeDatabase>, treatments = input.treatments) {
  return deriveAlertCandidates({
    settings: input.settings,
    farmers: input.farmers,
    holdings: input.holdings,
    products: input.pesticides,
    movements: input.inventoryMovements,
    treatments,
    registrationRequests: input.registrationRequests,
  });
}

describe('record-derived alerts', () => {
  it('creates a low-stock alert only where movements exist', () => {
    const db = makeDatabase();
    const alerts = derive(db);
    const lowStock = alerts.filter((alert) => alert.category === 'LOW_STOCK');
    expect(lowStock).toHaveLength(1);
    expect(lowStock[0]).toMatchObject({
      severity: 'WARNING',
      holdingId: 'HLD-001',
      data: { productId: 'PRD-MASS', balance: 1, threshold: 2, unit: 'kg' },
    });
  });

  it('creates a pending-registration alert from the request record', () => {
    const db = makeDatabase();
    const pending = derive(db).filter((alert) => alert.category === 'PENDING_REGISTRATION');
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ entityId: 'REG-003', farmerId: 'FRM-003', severity: 'INFO' });
  });

  it('flags missing reference doses, area mismatches and unlinked consumption', () => {
    const db = makeDatabase();
    const treatment = makeTreatment({
      id: 'TRT-EDGE',
      productId: 'PRD-NOREF',
      referenceDose: undefined,
      referenceDoseUnit: undefined,
      referenceDoseStatus: 'MISSING',
      treatedAreaHa: 3,
      totalCropAreaHa: 2,
      quantityApplied: 1,
      consumptionMovementId: undefined,
    });
    const alerts = derive(db, [treatment]);
    const categories = alerts.map((alert) => alert.category);
    expect(categories).toContain('INCOMPLETE_TREATMENT');
    expect(categories).toContain('AREA_MISMATCH');
    expect(categories).toContain('INSUFFICIENT_STOCK');

    const unverified = makeTreatment({
      id: 'TRT-UNVERIFIED',
      referenceDoseStatus: 'DEMO',
      consumptionMovementId: 'MOV-EXISTS',
    });
    expect(derive(db, [unverified]).map((alert) => alert.category)).toContain('UNVERIFIED_REFERENCE_DOSE');
  });

  it('keeps read state and marks alerts resolved when the underlying record disappears', () => {
    const db = makeDatabase();
    const candidates = derive(db);
    const first = mergeAlerts([], candidates, FIXTURE_NOW);
    expect(first.every((alert) => !alert.read && !alert.resolved)).toBe(true);

    const readFirst = first.map((alert) => ({
      ...alert,
      read: alert.category === 'PENDING_REGISTRATION',
    }));
    const merged = mergeAlerts(readFirst, candidates, '2026-03-16T09:00:00.000Z');
    expect(merged.every((alert) => alert.read === (alert.category === 'PENDING_REGISTRATION'))).toBe(true);

    const resolved = mergeAlerts(merged, [], '2026-03-17T09:00:00.000Z');
    expect(resolved.every((alert) => alert.resolved)).toBe(true);
    expect(resolved.every((alert) => alert.resolvedAt === '2026-03-17T09:00:00.000Z')).toBe(true);
  });
});
