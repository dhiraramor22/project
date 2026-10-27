import { describe, expect, it } from 'vitest';
import { generateReport } from '../../server/services/reports';
import { buildScopedView } from '../../server/services/scopedData';
import { authFor, makeDatabase, makeTreatment } from '../fixtures';

function reportFor(db: ReturnType<typeof makeDatabase>, userId: string, type: Parameters<typeof generateReport>[2], filters: Parameters<typeof generateReport>[3] = {}) {
  return generateReport(db, buildScopedView(db, authFor(db, userId)), type, filters);
}

describe('role-scoped reports', () => {
  it('produces inventory-balance rows and marks low stock from calculated balances', () => {
    const db = makeDatabase();
    const report = reportFor(db, 'U-DSA-001', 'inventory-balances');
    expect(report.rowCount).toBe(3);
    expect(report.demoData).toBe(true);
    expect(report.titleKey).toBe('reports.type.inventory-balances.title');

    const mass = report.rows.find((row) => row.product === 'Demo Mass Product');
    expect(mass).toMatchObject({ balance: 1, threshold: 2, lowStock: 'yes' });
    const volume = report.rows.find((row) => row.product === 'Demo Volume Product' && row.holding === 'Oasis Benali');
    expect(volume).toMatchObject({ balance: 20, lowStock: 'no' });
  });

  it('scopes report rows to the Chamber communes and to a farmer’s own records', () => {
    const db = makeDatabase();
    const chamber = reportFor(db, 'U-CHM-001', 'inventory-balances');
    expect(chamber.rowCount).toBe(2);
    expect(chamber.rows.every((row) => row.holding === 'Oasis Benali')).toBe(true);

    const farmer = reportFor(db, 'U-FRM-002', 'inventory-balances');
    expect(farmer.rowCount).toBe(1);
    expect(farmer.rows[0]).toMatchObject({ holding: 'Rahmani Farm', product: 'Demo Volume Product', balance: 6 });
  });

  it('never exposes registration or audit reports to non-DSA roles', () => {
    const db = makeDatabase();
    expect(reportFor(db, 'U-DSA-001', 'registrations').rowCount).toBe(3);
    expect(reportFor(db, 'U-CHM-001', 'registrations').rowCount).toBe(0);
    expect(reportFor(db, 'U-FRM-001', 'registrations').rowCount).toBe(0);

    expect(reportFor(db, 'U-DSA-001', 'audit-logs').rowCount).toBe(0);
    expect(reportFor(db, 'U-CHM-001', 'audit-logs').rowCount).toBe(0);
  });

  it('applies filters to treatments and inventory movements', () => {
    const db = makeDatabase();
    db.treatments = [
      makeTreatment({ id: 'TRT-1', productId: 'PRD-VOL', treatmentDate: '2026-02-01' }),
      makeTreatment({
        id: 'TRT-2',
        productId: 'PRD-MASS',
        treatmentDate: '2026-03-01',
        appliedDoseUnit: 'kg/ha',
        quantityUnit: 'kg',
        referenceDoseUnit: 'kg/ha',
      }),
    ];
    expect(reportFor(db, 'U-DSA-001', 'treatments').rowCount).toBe(2);
    expect(reportFor(db, 'U-DSA-001', 'treatments', { productId: 'PRD-MASS' }).rows[0]?.id).toBe('TRT-2');
    expect(reportFor(db, 'U-DSA-001', 'treatments', { from: '2026-02-15' }).rowCount).toBe(1);
    expect(
      reportFor(db, 'U-DSA-001', 'inventory-movements', { holdingId: 'HLD-002' }).rows.every(
        (row) => row.holding === 'Rahmani Farm',
      ),
    ).toBe(true);
  });

  it('labels the TFI report as provisional and calculates from the scoped treatments', () => {
    const db = makeDatabase();
    db.treatments = [makeTreatment({ id: 'TRT-1', treatedAreaHa: 1, appliedDose: 2, referenceDose: 2 })];
    const report = reportFor(db, 'U-DSA-001', 'tfi-by-crop-season');
    expect(report.rowCount).toBe(1);
    expect(report.rows[0]).toMatchObject({
      crop: 'Tomato',
      tfi: 0.5,
      status: 'OK',
      denominatorArea: 2,
      methodology: 'Provisional / Demo demo-1.0',
    });
  });

  it('generates farmer, holding and low-stock reports from real records', () => {
    const db = makeDatabase();
    const farmers = reportFor(db, 'U-DSA-001', 'farmers');
    expect(farmers.rowCount).toBe(3);
    expect(farmers.rows.find((row) => row.id === 'FRM-001')).toMatchObject({ holdings: 1, area: 2 });

    const holdings = reportFor(db, 'U-CHM-001', 'holdings');
    expect(holdings.rowCount).toBe(1);
    expect(holdings.rows[0]).toMatchObject({ holding: 'Oasis Benali', plots: 1, crops: 1 });

    // No alerts exist until the derived alert state is persisted.
    expect(reportFor(db, 'U-DSA-001', 'low-stock-alerts').rowCount).toBe(0);
  });
});
