import type { AccessScope, AgriculturalHolding, AuthContext, CropRecord, TreatmentRecord } from '../../src/domain/types';
import { holdingIsInScope, farmerIsInScope, treatmentIsInScope } from '../../src/domain/scope';
import { ApiError } from '../http/errors';
import type { Database } from '../../src/domain/types';

export function scopeFromAuth(auth: AuthContext): AccessScope {
  return {
    role: auth.role,
    userId: auth.user.id,
    farmerId: auth.farmerId,
    scopeCommunes: auth.scopeCommunes,
  };
}

export function assertHoldingAccess(auth: AuthContext, holding: AgriculturalHolding): void {
  if (!holdingIsInScope(scopeFromAuth(auth), holding)) {
    throw new ApiError(403, 'OUT_OF_SCOPE', 'This agricultural holding is outside your permitted scope.');
  }
}

export function assertFarmerAccess(auth: AuthContext, farmerId: string, db: Database): void {
  const farmer = db.farmers.find((item) => item.id === farmerId);
  if (!farmer) throw new ApiError(404, 'FARMER_NOT_FOUND', 'Farmer was not found.');
  if (!farmerIsInScope(scopeFromAuth(auth), farmer)) {
    throw new ApiError(403, 'OUT_OF_SCOPE', 'This farmer is outside your permitted scope.');
  }
}

export function assertTreatmentAccess(
  auth: AuthContext,
  treatment: TreatmentRecord,
  db: Database,
): void {
  if (!treatmentIsInScope(scopeFromAuth(auth), treatment, db.holdings)) {
    throw new ApiError(403, 'OUT_OF_SCOPE', 'This treatment is outside your permitted scope.');
  }
}

export function assertCropBelongsToHolding(crop: CropRecord, holdingId: string): void {
  if (crop.holdingId !== holdingId) {
    throw new ApiError(400, 'CROP_HOLDING_MISMATCH', 'The selected crop does not belong to this holding.');
  }
}
