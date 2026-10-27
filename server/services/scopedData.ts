import { farmerIsInScope, holdingIsInScope } from '../../src/domain/scope';
import type {
  Alert,
  AuditEvent,
  AuthContext,
  CropRecord,
  Database,
  FarmerProfile,
  AgriculturalHolding,
  InventoryMovement,
  Plot,
  RegistrationRequest,
  TreatmentRecord,
  User,
} from '../../src/domain/types';

export interface ScopedView {
  farmers: FarmerProfile[];
  holdings: AgriculturalHolding[];
  plots: Plot[];
  crops: CropRecord[];
  movements: InventoryMovement[];
  treatments: TreatmentRecord[];
  alerts: Alert[];
  registrationRequests: RegistrationRequest[];
  auditLog: AuditEvent[];
  users: User[];
  scopedFarmerIds: Set<string>;
}

/**
 * Central data scoping used by bootstrap, reports and export endpoints.
 * This is prototype authorization, not production-grade security.
 */
export function buildScopedView(db: Database, auth: AuthContext): ScopedView {
  const scope = {
    role: auth.role,
    userId: auth.user.id,
    farmerId: auth.farmerId,
    scopeCommunes: auth.scopeCommunes,
  };

  const holdings = db.holdings.filter((holding) => holdingIsInScope(scope, holding));
  const holdingIds = new Set(holdings.map((holding) => holding.id));
  const scopedFarmerIds = new Set<string>(holdings.map((holding) => holding.ownerFarmerId));

  const farmers = db.farmers.filter(
    (farmer) => farmerIsInScope(scope, farmer) || scopedFarmerIds.has(farmer.id),
  );
  for (const farmer of farmers) scopedFarmerIds.add(farmer.id);

  const plots = db.plots.filter((plot) => holdingIds.has(plot.holdingId));
  const crops = db.crops.filter(
    (crop) =>
      holdingIds.has(crop.holdingId) &&
      (auth.role !== 'FARMER' || crop.farmerId === auth.farmerId) &&
      (auth.role !== 'CHAMBER_ADMIN' || scopedFarmerIds.has(crop.farmerId)),
  );
  const movements = db.inventoryMovements.filter(
    (movement) =>
      holdingIds.has(movement.holdingId) &&
      (auth.role !== 'FARMER' || movement.farmerId === auth.farmerId) &&
      (auth.role !== 'CHAMBER_ADMIN' || scopedFarmerIds.has(movement.farmerId)),
  );
  const treatments = db.treatments.filter(
    (treatment) =>
      holdingIds.has(treatment.holdingId) &&
      (auth.role !== 'FARMER' || treatment.farmerId === auth.farmerId) &&
      (auth.role !== 'CHAMBER_ADMIN' || scopedFarmerIds.has(treatment.farmerId)),
  );

  const alerts = db.alerts.filter((alert) => {
    if (auth.role === 'DSA_ADMIN') return true;
    if (alert.category === 'PENDING_REGISTRATION') return false;
    if (alert.holdingId) return holdingIds.has(alert.holdingId);
    return Boolean(alert.farmerId && scopedFarmerIds.has(alert.farmerId));
  });

  const registrationRequests =
    auth.role === 'DSA_ADMIN'
      ? db.registrationRequests
      : [];

  const auditLog = auth.role === 'DSA_ADMIN' ? db.auditLog : [];

  const users =
    auth.role === 'DSA_ADMIN' ? db.users : db.users.filter((user) => user.id === auth.user.id);

  return {
    farmers,
    holdings,
    plots,
    crops,
    movements,
    treatments,
    alerts,
    registrationRequests,
    auditLog,
    users,
    scopedFarmerIds,
  };
}
