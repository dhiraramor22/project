import { convertDose, roundQuantity } from './inventory';
import type {
  AgriculturalHolding,
  CropRecord,
  Plot,
  TFICalculationResult,
  TFIConfiguration,
  TFIExclusion,
  TFIScopeType,
  TFITreatmentContribution,
  TreatmentRecord,
} from './types';

export const TFI_METHODOLOGY_VERSION = 'demo-1.0';

export interface TFICalculationInput {
  treatments: TreatmentRecord[];
  crops: CropRecord[];
  plots: Plot[];
  holdings: AgriculturalHolding[];
  config: TFIConfiguration;
  scopeType: TFIScopeType;
  scopeId?: string;
  seasonId?: string;
  dateFrom?: string;
  dateTo?: string;
}

function cropAreaForScope(input: TFICalculationInput): number {
  const { scopeType, scopeId, seasonId, crops } = input;
  const inSeason = (crop: CropRecord) =>
    !seasonId || crop.seasonId === seasonId || (scopeType === 'SEASON' && crop.seasonId === scopeId);

  const relevant = crops.filter((crop) => {
    if (!inSeason(crop)) return false;
    switch (scopeType) {
      case 'CROP':
        return crop.id === scopeId;
      case 'PLOT':
        return crop.plotId === scopeId;
      case 'HOLDING':
        return crop.holdingId === scopeId;
      case 'SEASON':
        return crop.seasonId === (scopeId ?? seasonId);
      case 'ALL':
        return true;
      case 'TREATMENT':
      default:
        return false;
    }
  });

  return roundQuantity(relevant.reduce((sum, crop) => sum + Math.max(0, crop.areaHa), 0));
}

function treatmentMatchesScope(treatment: TreatmentRecord, input: TFICalculationInput): boolean {
  const { scopeType, scopeId, seasonId, dateFrom, dateTo } = input;
  if (seasonId && treatment.seasonId !== seasonId) return false;
  if (dateFrom && treatment.treatmentDate < dateFrom) return false;
  if (dateTo && treatment.treatmentDate > dateTo) return false;

  switch (scopeType) {
    case 'TREATMENT':
      return treatment.id === scopeId;
    case 'CROP':
      return treatment.cropId === scopeId;
    case 'PLOT':
      return treatment.plotId === scopeId;
    case 'HOLDING':
      return treatment.holdingId === scopeId;
    case 'SEASON':
      return treatment.seasonId === (scopeId ?? seasonId);
    case 'ALL':
      return true;
    default:
      return false;
  }
}

/**
 * Provisional, configurable demonstration TFI.
 *
 * For every treatment: dose ratio = applied dose / reference dose (converted to the
 * reference dose unit within the same dimension). Area weighting is applied as
 * treated area / denominator area. The denominator is either the aggregate crop area
 * or the aggregate treated area, according to configuration.
 *
 * This is NOT an officially mandated Algerian TFI methodology. Mixing mass- and
 * volume-based dose units inside one treatment is rejected rather than converted.
 */
export function calculateTFI(input: TFICalculationInput): TFICalculationResult {
  const includedTreatments: TFITreatmentContribution[] = [];
  const excludedTreatments: TFIExclusion[] = [];
  const seen = new Set<string>();

  const treatments = input.treatments
    .filter((treatment) => treatment.status === 'ACTIVE' && treatmentMatchesScope(treatment, input))
    .slice()
    .sort((a, b) => a.treatmentDate.localeCompare(b.treatmentDate));

  const cropArea = cropAreaForScope(input);
  const treatedAreaTotal = roundQuantity(
    treatments.reduce((sum, treatment) => sum + Math.max(0, treatment.treatedAreaHa), 0),
  );
  const denominatorAreaHa =
    input.scopeType === 'TREATMENT'
      ? roundQuantity(treatments[0]?.treatedAreaHa ?? 0)
      : input.config.normalization === 'TREATED_AREA'
        ? treatedAreaTotal
        : cropArea;

  const config = {
    version: input.config.version,
    strategy: input.config.strategy,
    normalization: input.config.normalization,
    requireVerifiedDose: input.config.requireVerifiedDose,
    allowDemoReferenceDoses: input.config.allowDemoReferenceDoses,
  } as const;

  for (const treatment of treatments) {
    if (seen.has(treatment.id)) {
      excludedTreatments.push({
        treatmentId: treatment.id,
        reason: 'DUPLICATE_TREATMENT',
        detail: 'The same treatment identifier was supplied more than once.',
      });
      continue;
    }
    seen.add(treatment.id);

    if (!Number.isFinite(treatment.treatedAreaHa) || treatment.treatedAreaHa <= 0) {
      excludedTreatments.push({
        treatmentId: treatment.id,
        reason: 'INVALID_AREA',
      });
      continue;
    }

    if (treatment.referenceDose === undefined || treatment.referenceDose === null) {
      excludedTreatments.push({
        treatmentId: treatment.id,
        reason: 'MISSING_REFERENCE_DOSE',
      });
      continue;
    }
    if (!Number.isFinite(treatment.referenceDose) || treatment.referenceDose <= 0) {
      excludedTreatments.push({
        treatmentId: treatment.id,
        reason: 'INVALID_REFERENCE_DOSE',
      });
      continue;
    }
    if (!treatment.referenceDoseUnit) {
      excludedTreatments.push({
        treatmentId: treatment.id,
        reason: 'MISSING_REFERENCE_DOSE',
      });
      continue;
    }
    if (!Number.isFinite(treatment.appliedDose) || treatment.appliedDose <= 0) {
      excludedTreatments.push({
        treatmentId: treatment.id,
        reason: 'INVALID_DOSE',
      });
      continue;
    }
    if (input.config.requireVerifiedDose && treatment.referenceDoseStatus !== 'VERIFIED') {
      excludedTreatments.push({
        treatmentId: treatment.id,
        reason: 'UNVERIFIED_REFERENCE_DOSE',
      });
      continue;
    }
    if (
      treatment.referenceDoseStatus !== 'VERIFIED' &&
      !input.config.allowDemoReferenceDoses
    ) {
      excludedTreatments.push({
        treatmentId: treatment.id,
        reason: 'UNVERIFIED_REFERENCE_DOSE',
      });
      continue;
    }

    const appliedInReferenceUnit = convertDose(
      treatment.appliedDose,
      treatment.appliedDoseUnit,
      treatment.referenceDoseUnit,
    );
    if (appliedInReferenceUnit === null) {
      excludedTreatments.push({
        treatmentId: treatment.id,
        reason: 'INCOMPATIBLE_DOSE_UNITS',
        detail: `${treatment.appliedDoseUnit} cannot be combined with ${treatment.referenceDoseUnit}.`,
      });
      continue;
    }

    const doseRatio = appliedInReferenceUnit / treatment.referenceDose;
    if (!Number.isFinite(doseRatio) || doseRatio < 0) {
      excludedTreatments.push({
        treatmentId: treatment.id,
        reason: 'INVALID_DOSE',
      });
      continue;
    }

    if (denominatorAreaHa <= 0) {
      excludedTreatments.push({
        treatmentId: treatment.id,
        reason: 'INVALID_AREA',
        detail: 'The denominator area for this scope is zero. Add crop or plot areas first.',
      });
      continue;
    }

    const weightedIndex =
      input.scopeType === 'TREATMENT'
        ? doseRatio
        : doseRatio * (treatment.treatedAreaHa / denominatorAreaHa);

    includedTreatments.push({
      treatmentId: treatment.id,
      cropId: treatment.cropId,
      plotId: treatment.plotId,
      holdingId: treatment.holdingId,
      productId: treatment.productId,
      treatedAreaHa: treatment.treatedAreaHa,
      doseRatio: roundQuantity(doseRatio),
      weightedIndex: roundQuantity(weightedIndex),
      referenceDoseStatus: treatment.referenceDoseStatus,
      referenceDose: treatment.referenceDose,
      referenceDoseUnit: treatment.referenceDoseUnit,
      appliedDose: treatment.appliedDose,
      appliedDoseUnit: treatment.appliedDoseUnit,
    });
  }

  const sum = roundQuantity(
    includedTreatments.reduce((total, contribution) => total + contribution.weightedIndex, 0),
  );

  let status: TFICalculationResult['status'];
  if (treatments.length === 0) status = 'EMPTY';
  else if (excludedTreatments.length > 0) status = 'INCOMPLETE';
  else status = 'OK';

  return {
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    seasonId: input.seasonId ?? (input.scopeType === 'SEASON' ? input.scopeId : undefined),
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    value: includedTreatments.length > 0 ? sum : null,
    status,
    includedTreatments,
    excludedTreatments,
    denominatorAreaHa,
    treatmentCount: treatments.length,
    configuration: config,
    methodologyVersion: TFI_METHODOLOGY_VERSION,
    calculatedAt: new Date().toISOString(),
    provisional: true,
  };
}

export interface TFISummaryGroup {
  key: string;
  label: string;
  result: TFICalculationResult;
}

export function summarizeTFIByCrop(
  base: Omit<TFICalculationInput, 'scopeType' | 'scopeId'>,
  cropIds: string[],
  cropNames: Map<string, string>,
): TFISummaryGroup[] {
  return cropIds.map((cropId) => ({
    key: cropId,
    label: cropNames.get(cropId) ?? cropId,
    result: calculateTFI({ ...base, scopeType: 'CROP', scopeId: cropId }),
  }));
}

export function summarizeTFIByHolding(
  base: Omit<TFICalculationInput, 'scopeType' | 'scopeId'>,
  holdingIds: string[],
  holdingNames: Map<string, string>,
): TFISummaryGroup[] {
  return holdingIds.map((holdingId) => ({
    key: holdingId,
    label: holdingNames.get(holdingId) ?? holdingId,
    result: calculateTFI({ ...base, scopeType: 'HOLDING', scopeId: holdingId }),
  }));
}
