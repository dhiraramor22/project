import { currentStock } from './inventory';
import type {
  Alert,
  AlertCategory,
  AlertSeverity,
  ApplicationSettings,
  AgriculturalHolding,
  FarmerProfile,
  InventoryMovement,
  PesticideProduct,
  RegistrationRequest,
  TreatmentRecord,
} from './types';

export interface AlertCandidate {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  farmerId?: string;
  holdingId?: string;
  entityType: string;
  entityId: string;
  titleKey: string;
  data: Record<string, string | number>;
}

export interface AlertDerivationInput {
  settings: ApplicationSettings;
  farmers: FarmerProfile[];
  holdings: AgriculturalHolding[];
  products: PesticideProduct[];
  movements: InventoryMovement[];
  treatments: TreatmentRecord[];
  registrationRequests: RegistrationRequest[];
}

function alertId(category: AlertCategory, entityId: string): string {
  return `${category}:${entityId}`;
}

/**
 * Alerts are derived from concrete local records. They are not regulatory alerts and
 * no legal deadline or threshold is implied.
 */
export function deriveAlertCandidates(input: AlertDerivationInput): AlertCandidate[] {
  const candidates = new Map<string, AlertCandidate>();
  const farmerMap = new Map(input.farmers.map((farmer) => [farmer.id, farmer]));
  const holdingMap = new Map(input.holdings.map((holding) => [holding.id, holding]));
  const productMap = new Map(input.products.map((product) => [product.id, product]));
  const treatmentMap = new Map(input.treatments.map((treatment) => [treatment.id, treatment]));

  // Low stock per holding/product.
  for (const holding of input.holdings) {
    if (holding.status !== 'ACTIVE') continue;
    for (const product of input.products) {
      if (product.archived) continue;
      const hasMovements = input.movements.some(
        (movement) =>
          movement.holdingId === holding.id &&
          movement.productId === product.id &&
          movement.status === 'ACTIVE',
      );
      if (!hasMovements) continue;
      const balance = currentStock(input.movements, holding.id, product.id, product.stockUnit);
      const threshold = product.lowStockThreshold ?? input.settings.lowStockThreshold;
      if (balance <= threshold) {
        const id = alertId('LOW_STOCK', `${holding.id}:${product.id}`);
        candidates.set(id, {
          id,
          category: 'LOW_STOCK',
          severity: balance <= 0 ? 'CRITICAL' : 'WARNING',
          farmerId: holding.ownerFarmerId,
          holdingId: holding.id,
          entityType: 'inventory',
          entityId: `${holding.id}:${product.id}`,
          titleKey: 'alerts.lowStock.title',
          data: {
            product: product.commercialName,
            productId: product.id,
            holding: holding.name,
            holdingId: holding.id,
            balance,
            unit: product.stockUnit,
            threshold,
          },
        });
      }
    }
  }

  // Pending registrations.
  for (const request of input.registrationRequests) {
    if (request.status !== 'PENDING') continue;
    const farmer = farmerMap.get(request.farmerId);
    if (!farmer) continue;
    const id = alertId('PENDING_REGISTRATION', request.id);
    candidates.set(id, {
      id,
      category: 'PENDING_REGISTRATION',
      severity: 'INFO',
      farmerId: farmer.id,
      entityType: 'registration',
      entityId: request.id,
      titleKey: 'alerts.pendingRegistration.title',
      data: { farmer: farmer.fullName, commune: farmer.commune },
    });
  }

  // Treatment consistency alerts.
  for (const treatment of input.treatments) {
    if (treatment.status !== 'ACTIVE') continue;
    const product = productMap.get(treatment.productId);
    const holding = holdingMap.get(treatment.holdingId);
    if (!product || !holding) continue;

    if (treatment.referenceDoseStatus === 'MISSING' || !treatment.referenceDose) {
      const id = alertId('INCOMPLETE_TREATMENT', treatment.id);
      candidates.set(id, {
        id,
        category: 'INCOMPLETE_TREATMENT',
        severity: 'WARNING',
        farmerId: treatment.farmerId,
        holdingId: treatment.holdingId,
        entityType: 'treatment',
        entityId: treatment.id,
        titleKey: 'alerts.incompleteTreatment.title',
        data: {
          product: product.commercialName,
          holding: holding.name,
          date: treatment.treatmentDate,
        },
      });
    } else if (treatment.referenceDoseStatus !== 'VERIFIED') {
      const id = alertId('UNVERIFIED_REFERENCE_DOSE', treatment.id);
      candidates.set(id, {
        id,
        category: 'UNVERIFIED_REFERENCE_DOSE',
        severity: 'INFO',
        farmerId: treatment.farmerId,
        holdingId: treatment.holdingId,
        entityType: 'treatment',
        entityId: treatment.id,
        titleKey: 'alerts.unverifiedReferenceDose.title',
        data: {
          product: product.commercialName,
          source: treatment.referenceSource ?? '—',
        },
      });
    }

    if (
      Number.isFinite(treatment.treatedAreaHa) &&
      Number.isFinite(treatment.totalCropAreaHa) &&
      treatment.treatedAreaHa > treatment.totalCropAreaHa + 0.0001
    ) {
      const id = alertId('AREA_MISMATCH', treatment.id);
      candidates.set(id, {
        id,
        category: 'AREA_MISMATCH',
        severity: 'WARNING',
        farmerId: treatment.farmerId,
        holdingId: treatment.holdingId,
        entityType: 'treatment',
        entityId: treatment.id,
        titleKey: 'alerts.areaMismatch.title',
        data: {
          treated: treatment.treatedAreaHa,
          total: treatment.totalCropAreaHa,
        },
      });
    }

    if (treatment.quantityApplied > 0) {
      const linked = treatment.consumptionMovementId
        ? input.movements.find((movement) => movement.id === treatment.consumptionMovementId)
        : undefined;
      if (!linked || linked.status === 'REVERSED') {
        const id = alertId('INSUFFICIENT_STOCK', treatment.id);
        candidates.set(id, {
          id,
          category: 'INSUFFICIENT_STOCK',
          severity: 'CRITICAL',
          farmerId: treatment.farmerId,
          holdingId: treatment.holdingId,
          entityType: 'treatment',
          entityId: treatment.id,
          titleKey: 'alerts.insufficientStock.title',
          data: {
            product: product.commercialName,
            holding: holding.name,
            date: treatment.treatmentDate,
          },
        });
      }
    }

    // Referenced treatment should still exist.
    if (input.movements.some((movement) => movement.treatmentId === treatment.id) === false) {
      // Intentionally not an alert: opening balances and treatments are independent.
    }
  }

  // Orphan consumption movements (defensive consistency check).
  for (const movement of input.movements) {
    if (movement.status !== 'ACTIVE' || movement.type !== 'CONSUMPTION') continue;
    if (!movement.treatmentId) continue;
    if (treatmentMap.has(movement.treatmentId)) continue;
    const product = productMap.get(movement.productId);
    const id = alertId('INSUFFICIENT_STOCK', `movement:${movement.id}`);
    candidates.set(id, {
      id,
      category: 'INSUFFICIENT_STOCK',
      severity: 'CRITICAL',
      farmerId: movement.farmerId,
      holdingId: movement.holdingId,
      entityType: 'movement',
      entityId: movement.id,
      titleKey: 'alerts.orphanConsumption.title',
      data: { product: product?.commercialName ?? movement.productId },
    });
  }

  return [...candidates.values()];
}

/** Merges derived candidates with persisted alert state (read/resolved timestamps). */
export function mergeAlerts(
  existing: Alert[],
  candidates: AlertCandidate[],
  now: string,
): Alert[] {
  const existingById = new Map(existing.map((alert) => [alert.id, alert]));
  const next: Alert[] = [];

  for (const candidate of candidates) {
    const previous = existingById.get(candidate.id);
    next.push({
      ...candidate,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      read: previous?.read ?? false,
      resolved: false,
      resolvedAt: undefined,
    });
    existingById.delete(candidate.id);
  }

  for (const stale of existingById.values()) {
    if (stale.resolved) {
      next.push(stale);
    } else {
      next.push({ ...stale, resolved: true, resolvedAt: now, updatedAt: now });
    }
  }

  return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
