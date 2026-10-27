import { describe, expect, it } from 'vitest';
import { calculateTFI, TFI_METHODOLOGY_VERSION } from '../../src/domain/tfi';
import type { TFICalculationInput } from '../../src/domain/tfi';
import { makeDatabase, makeTreatment } from '../fixtures';

function input(overrides: Partial<TFICalculationInput> = {}): TFICalculationInput {
  const db = makeDatabase();
  return {
    treatments: [],
    crops: db.crops,
    plots: db.plots,
    holdings: db.holdings,
    config: db.tfiConfig,
    scopeType: 'CROP',
    scopeId: 'CRP-001',
    seasonId: 'SSN-2026',
    ...overrides,
  };
}

describe('provisional TFI methodology', () => {
  it('weights the dose ratio by treated area over the configured crop area', () => {
    const result = calculateTFI(
      input({
        treatments: [
          makeTreatment({ id: 'TRT-1', treatedAreaHa: 1, appliedDose: 2, referenceDose: 2 }),
          makeTreatment({
            id: 'TRT-2',
            treatedAreaHa: 1,
            appliedDose: 3,
            referenceDose: 2,
            referenceDoseStatus: 'DEMO',
            referenceDoseUnit: 'kg/ha',
            appliedDoseUnit: 'kg/ha',
            quantityUnit: 'kg',
            productId: 'PRD-MASS',
          }),
        ],
      }),
    );

    expect(result.status).toBe('OK');
    expect(result.value).toBe(1.25);
    expect(result.denominatorAreaHa).toBe(2);
    expect(result.includedTreatments).toHaveLength(2);
    expect(result.includedTreatments[0]).toMatchObject({ doseRatio: 1, weightedIndex: 0.5 });
    expect(result.includedTreatments[1]).toMatchObject({ doseRatio: 1.5, weightedIndex: 0.75 });
    expect(result.methodologyVersion).toBe(TFI_METHODOLOGY_VERSION);
    expect(result.provisional).toBe(true);
  });

  it('supports treated-area normalization without inventing a regulatory threshold', () => {
    const db = makeDatabase();
    const result = calculateTFI(
      input({
        config: { ...db.tfiConfig, normalization: 'TREATED_AREA' },
        treatments: [
          makeTreatment({ id: 'TRT-1', treatedAreaHa: 1, appliedDose: 2, referenceDose: 2 }),
          makeTreatment({ id: 'TRT-2', treatedAreaHa: 1, appliedDose: 3, referenceDose: 2 }),
        ],
      }),
    );
    expect(result.denominatorAreaHa).toBe(2);
    expect(result.value).toBe(1.25);
  });

  it('uses only the dose ratio for a single-treatment scope', () => {
    const result = calculateTFI(
      input({
        scopeType: 'TREATMENT',
        scopeId: 'TRT-1',
        treatments: [makeTreatment({ id: 'TRT-1', appliedDose: 3, referenceDose: 2, treatedAreaHa: 0.5 })],
      }),
    );
    expect(result.value).toBe(1.5);
    expect(result.denominatorAreaHa).toBe(0.5);
    expect(result.includedTreatments[0]?.weightedIndex).toBe(1.5);
  });

  it('converts compatible dose units before calculating the ratio', () => {
    const result = calculateTFI(
      input({
        treatments: [
          makeTreatment({
            id: 'TRT-1',
            appliedDose: 2000,
            appliedDoseUnit: 'mL/ha',
            referenceDose: 2,
            referenceDoseUnit: 'L/ha',
            treatedAreaHa: 1,
          }),
        ],
      }),
    );
    expect(result.includedTreatments[0]).toMatchObject({ doseRatio: 1 });
  });

  it('excludes missing reference doses and allows demo doses only when configured', () => {
    const result = calculateTFI(
      input({
        treatments: [
          makeTreatment({ id: 'TRT-MISSING', referenceDose: undefined, referenceDoseUnit: undefined, referenceDoseStatus: 'MISSING' }),
          makeTreatment({ id: 'TRT-DEMO', referenceDoseStatus: 'DEMO', appliedDose: 1, referenceDose: 2 }),
          makeTreatment({ id: 'TRT-OK', appliedDose: 2, referenceDose: 2 }),
        ],
      }),
    );
    expect(result.status).toBe('INCOMPLETE');
    expect(result.value).toBe(0.75);
    expect(result.excludedTreatments.map((item) => item.reason)).toEqual(['MISSING_REFERENCE_DOSE']);
    expect(result.includedTreatments.map((item) => item.treatmentId)).toEqual(['TRT-DEMO', 'TRT-OK']);

    const strictDb = makeDatabase();
    const strict = calculateTFI(
      input({
        config: { ...strictDb.tfiConfig, requireVerifiedDose: true },
        treatments: [makeTreatment({ id: 'TRT-DEMO', referenceDoseStatus: 'DEMO' })],
      }),
    );
    expect(strict.status).toBe('INCOMPLETE');
    expect(strict.includedTreatments).toHaveLength(0);
    expect(strict.excludedTreatments[0]?.reason).toBe('UNVERIFIED_REFERENCE_DOSE');
  });

  it('rejects cross-dimension dose units instead of converting mass to volume', () => {
    const result = calculateTFI(
      input({
        treatments: [
          makeTreatment({
            id: 'TRT-BAD-UNIT',
            appliedDose: 2,
            appliedDoseUnit: 'kg/ha',
            referenceDose: 2,
            referenceDoseUnit: 'L/ha',
          }),
        ],
      }),
    );
    expect(result.includedTreatments).toHaveLength(0);
    expect(result.excludedTreatments[0]?.reason).toBe('INCOMPATIBLE_DOSE_UNITS');
    expect(result.value).toBeNull();
  });

  it('ignores reversed records, filters by scope and date, and de-duplicates IDs', () => {
    const db = makeDatabase();
    const base = [
      makeTreatment({ id: 'TRT-1', treatmentDate: '2026-02-01' }),
      makeTreatment({ id: 'TRT-2', holdingId: 'HLD-002', cropId: 'CRP-002', plotId: 'PLT-002', farmerId: 'FRM-002', treatmentDate: '2026-02-02' }),
      makeTreatment({ id: 'TRT-REVERSED', status: 'REVERSED', treatmentDate: '2026-02-03' }),
    ];
    const scoped = calculateTFI(input({ treatments: base }));
    expect(scoped.treatmentCount).toBe(1);
    expect(scoped.includedTreatments.map((item) => item.treatmentId)).toEqual(['TRT-1']);

    const ranged = calculateTFI(input({ treatments: base, dateFrom: '2026-02-02', dateTo: '2026-02-28' }));
    expect(ranged.includedTreatments).toHaveLength(0);

    const duplicated = calculateTFI(input({ treatments: [base[0]!, base[0]!] }));
    expect(duplicated.excludedTreatments[0]?.reason).toBe('DUPLICATE_TREATMENT');
    expect(duplicated.includedTreatments).toHaveLength(1);
    expect(db.treatments).toHaveLength(0);

    const all = calculateTFI(input({ scopeType: 'ALL', scopeId: undefined, treatments: base }));
    expect(all.includedTreatments.map((item) => item.treatmentId).sort()).toEqual(['TRT-1', 'TRT-2']);
  });

  it('returns EMPTY when there are no treatments, without a fabricated value', () => {
    const result = calculateTFI(input());
    expect(result.status).toBe('EMPTY');
    expect(result.value).toBeNull();
    expect(result.treatmentCount).toBe(0);
  });

  it('reports a zero denominator instead of dividing by zero', () => {
    const db = makeDatabase();
    const result = calculateTFI(
      input({
        crops: db.crops.map((record) => (record.id === 'CRP-001' ? { ...record, areaHa: 0 } : record)),
        treatments: [makeTreatment({ id: 'TRT-1', treatedAreaHa: 1 })],
      }),
    );
    expect(result.value).toBeNull();
    expect(result.status).toBe('INCOMPLETE');
    expect(result.excludedTreatments[0]?.reason).toBe('INVALID_AREA');
  });
});
