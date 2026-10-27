import { describe, expect, it } from 'vitest';
import { buildScopedView } from '../../server/services/scopedData';
import { syncAlerts } from '../../server/services/alerts';
import { authFor, makeDatabase, makeTreatment } from '../fixtures';

describe('central scoped views', () => {
  it('gives the DSA administrator the full dataset', () => {
    const db = makeDatabase();
    syncAlerts(db);
    const view = buildScopedView(db, authFor(db, 'U-DSA-001'));

    expect(view.farmers).toHaveLength(3);
    expect(view.holdings).toHaveLength(2);
    expect(view.crops).toHaveLength(2);
    expect(view.movements).toHaveLength(3);
    expect(view.registrationRequests).toHaveLength(3);
    expect(view.auditLog.length).toBe(db.auditLog.length);
    expect(view.users).toHaveLength(4);
    expect(view.alerts.length).toBeGreaterThan(0);
  });

  it('limits the Chamber administrator to their communes and hides administration data', () => {
    const db = makeDatabase();
    syncAlerts(db);
    const view = buildScopedView(db, authFor(db, 'U-CHM-001'));

    expect(view.holdings.map((item) => item.id)).toEqual(['HLD-001']);
    expect(view.farmers.map((item) => item.id).sort()).toEqual(['FRM-001', 'FRM-003']);
    expect(view.crops.map((item) => item.id)).toEqual(['CRP-001']);
    expect(view.movements.every((item) => item.holdingId === 'HLD-001')).toBe(true);
    expect(view.registrationRequests).toEqual([]);
    expect(view.auditLog).toEqual([]);
    expect(view.users.map((item) => item.id)).toEqual(['U-CHM-001']);
    expect(view.alerts.some((alert) => alert.category === 'PENDING_REGISTRATION')).toBe(false);
    expect(view.alerts.every((alert) => alert.holdingId === 'HLD-001')).toBe(true);
  });

  it('shows a farmer only their own records', () => {
    const db = makeDatabase();
    const view = buildScopedView(db, authFor(db, 'U-FRM-001'));

    expect(view.farmers.map((item) => item.id)).toEqual(['FRM-001']);
    expect(view.holdings.map((item) => item.id)).toEqual(['HLD-001']);
    expect(view.plots.map((item) => item.id)).toEqual(['PLT-001']);
    expect(view.crops.map((item) => item.id)).toEqual(['CRP-001']);
    expect(view.movements.every((item) => item.farmerId === 'FRM-001')).toBe(true);
    expect(view.treatments).toEqual([]);
    expect(view.registrationRequests).toEqual([]);
    expect(view.auditLog).toEqual([]);
    expect(view.users.map((item) => item.id)).toEqual(['U-FRM-001']);
    expect(view.scopedFarmerIds).toEqual(new Set(['FRM-001']));
  });

  it('does not leak another farmer’s treatment through the scoped view', () => {
    const db = makeDatabase();
    db.treatments = [
      makeTreatment({ id: 'TRT-OWN' }),
      makeTreatment({ id: 'TRT-OTHER', farmerId: 'FRM-002', holdingId: 'HLD-002', cropId: 'CRP-002', plotId: 'PLT-002' }),
    ];
    const view = buildScopedView(db, authFor(db, 'U-FRM-001'));
    expect(view.treatments.map((item) => item.id)).toEqual(['TRT-OWN']);
  });
});
