import type {
  AccessScope,
  AgriculturalHolding,
  CropRecord,
  FarmerProfile,
  InventoryMovement,
  TreatmentRecord,
} from './types';

export function farmerIsInScope(scope: AccessScope, farmer: FarmerProfile): boolean {
  if (scope.role === 'DSA_ADMIN') return true;
  if (scope.role === 'FARMER') return farmer.id === scope.farmerId;
  if (scope.role === 'CHAMBER_ADMIN') {
    return !scope.scopeCommunes || scope.scopeCommunes.includes(farmer.commune);
  }
  return false;
}

export function holdingIsInScope(scope: AccessScope, holding: AgriculturalHolding): boolean {
  if (scope.role === 'DSA_ADMIN') return true;
  if (scope.role === 'FARMER') return holding.ownerFarmerId === scope.farmerId;
  if (scope.role === 'CHAMBER_ADMIN') {
    return !scope.scopeCommunes || scope.scopeCommunes.includes(holding.commune);
  }
  return false;
}

export function cropIsInScope(
  scope: AccessScope,
  crop: CropRecord,
  holdings: AgriculturalHolding[],
): boolean {
  if (scope.role === 'DSA_ADMIN') return true;
  if (scope.role === 'FARMER') return crop.farmerId === scope.farmerId;
  const holding = holdings.find((item) => item.id === crop.holdingId);
  return holding ? holdingIsInScope(scope, holding) : false;
}

export function treatmentIsInScope(
  scope: AccessScope,
  treatment: TreatmentRecord,
  holdings: AgriculturalHolding[],
): boolean {
  if (scope.role === 'DSA_ADMIN') return true;
  if (scope.role === 'FARMER') return treatment.farmerId === scope.farmerId;
  const holding = holdings.find((item) => item.id === treatment.holdingId);
  return holding ? holdingIsInScope(scope, holding) : false;
}

export function movementIsInScope(
  scope: AccessScope,
  movement: InventoryMovement,
  holdings: AgriculturalHolding[],
): boolean {
  if (scope.role === 'DSA_ADMIN') return true;
  if (scope.role === 'FARMER') return movement.farmerId === scope.farmerId;
  const holding = holdings.find((item) => item.id === movement.holdingId);
  return holding ? holdingIsInScope(scope, holding) : false;
}

export function scopeToAccessScope(input: {
  role: AccessScope['role'];
  userId: string;
  farmerId?: string;
  scopeCommunes?: string[];
}): AccessScope {
  return {
    role: input.role,
    userId: input.userId,
    farmerId: input.farmerId,
    scopeCommunes: input.scopeCommunes,
  };
}
