import { summarizeStock, convertQuantity } from '../../src/domain/inventory';
import { calculateTFI } from '../../src/domain/tfi';
import type { Database, InventoryMovement } from '../../src/domain/types';
import type { ReportColumn, ReportResult, ReportType } from '../../src/domain/api';
import type { ScopedView } from './scopedData';

export interface ReportFilters {
  seasonId?: string;
  cropId?: string;
  holdingId?: string;
  productId?: string;
  from?: string;
  to?: string;
  status?: string;
}

type ReportRow = Record<string, string | number | null>;

const columns = (...items: ReportColumn[]): ReportColumn[] => items;

function dateInRange(value: string, from?: string, to?: string): boolean {
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

function movementMatches(movement: InventoryMovement, filters: ReportFilters): boolean {
  if (filters.holdingId && movement.holdingId !== filters.holdingId) return false;
  if (filters.productId && movement.productId !== filters.productId) return false;
  if (filters.status && movement.status !== filters.status) return false;
  if (!dateInRange(movement.occurredAt, filters.from, filters.to)) return false;
  return true;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function quantityLabel(
  movements: InventoryMovement[],
  productUnit: string,
): string {
  if (movements.length === 0) return '—';
  const normalizedUnit = productUnit as 'L' | 'mL' | 'kg' | 'g';
  const total = movements.reduce((sum, movement) => {
    const converted = convertQuantity(movement.quantity, movement.unit, normalizedUnit);
    return sum + (converted ?? 0);
  }, 0);
  return `${round(total)} ${normalizedUnit}`;
}

export function generateReport(
  db: Database,
  view: ScopedView,
  reportType: ReportType,
  filters: ReportFilters,
): ReportResult {
  const farmerMap = new Map(view.farmers.map((farmer) => [farmer.id, farmer]));
  const holdingMap = new Map(view.holdings.map((holding) => [holding.id, holding]));
  const productMap = new Map(db.pesticides.map((product) => [product.id, product]));
  const cropMap = new Map(view.crops.map((crop) => [crop.id, crop]));
  const plotMap = new Map(view.plots.map((plot) => [plot.id, plot]));
  const seasonMap = new Map(db.seasons.map((season) => [season.id, season]));

  let reportColumns: ReportColumn[] = [];
  let rows: ReportRow[] = [];

  switch (reportType) {
    case 'inventory-balances': {
      reportColumns = columns(
        { key: 'holding', labelKey: 'reports.column.holding' },
        { key: 'commune', labelKey: 'reports.column.commune' },
        { key: 'product', labelKey: 'reports.column.product' },
        { key: 'unit', labelKey: 'reports.column.unit' },
        { key: 'openingBalance', labelKey: 'reports.column.openingBalance' },
        { key: 'incoming', labelKey: 'reports.column.incoming' },
        { key: 'outgoing', labelKey: 'reports.column.outgoing' },
        { key: 'adjustments', labelKey: 'reports.column.adjustments' },
        { key: 'balance', labelKey: 'reports.column.balance' },
        { key: 'threshold', labelKey: 'reports.column.threshold' },
        { key: 'lowStock', labelKey: 'reports.column.lowStock' },
      );
      const pairs = new Map<string, { holdingId: string; productId: string }>();
      for (const movement of view.movements) {
        if (filters.holdingId && movement.holdingId !== filters.holdingId) continue;
        if (filters.productId && movement.productId !== filters.productId) continue;
        pairs.set(`${movement.holdingId}:${movement.productId}`, {
          holdingId: movement.holdingId,
          productId: movement.productId,
        });
      }
      rows = [...pairs.values()].map(({ holdingId, productId }) => {
        const holding = holdingMap.get(holdingId);
        const product = productMap.get(productId);
        const unit = product?.stockUnit ?? 'L';
        const summary = summarizeStock(view.movements, holdingId, productId, unit);
        const threshold = product?.lowStockThreshold ?? db.settings.lowStockThreshold;
        return {
          holding: holding?.name ?? holdingId,
          commune: holding?.commune ?? '',
          product: product?.commercialName ?? productId,
          unit,
          openingBalance: round(summary.openingBalance),
          incoming: round(summary.incoming),
          outgoing: round(summary.outgoing),
          adjustments: round(summary.adjustmentsIn - summary.adjustmentsOut),
          balance: round(summary.balance),
          threshold,
          lowStock: summary.balance <= threshold ? 'yes' : 'no',
        };
      });
      rows.sort((a, b) => String(a.holding).localeCompare(String(b.holding)));
      break;
    }

    case 'inventory-movements': {
      reportColumns = columns(
        { key: 'date', labelKey: 'reports.column.date' },
        { key: 'holding', labelKey: 'reports.column.holding' },
        { key: 'product', labelKey: 'reports.column.product' },
        { key: 'type', labelKey: 'reports.column.movementType' },
        { key: 'quantity', labelKey: 'reports.column.quantity' },
        { key: 'unit', labelKey: 'reports.column.unit' },
        { key: 'status', labelKey: 'reports.column.status' },
        { key: 'reference', labelKey: 'reports.column.reference' },
        { key: 'treatmentId', labelKey: 'reports.column.treatmentId' },
      );
      rows = view.movements
        .filter((movement) => movementMatches(movement, filters))
        .slice()
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .map((movement) => ({
          date: movement.occurredAt,
          holding: holdingMap.get(movement.holdingId)?.name ?? movement.holdingId,
          product: productMap.get(movement.productId)?.commercialName ?? movement.productId,
          type: movement.type,
          quantity: round(movement.quantity),
          unit: movement.unit,
          status: movement.status,
          reference: movement.supplierOrReference ?? '',
          treatmentId: movement.treatmentId ?? '',
        }));
      break;
    }

    case 'treatments': {
      reportColumns = columns(
        { key: 'id', labelKey: 'reports.column.treatmentId' },
        { key: 'date', labelKey: 'reports.column.date' },
        { key: 'farmer', labelKey: 'reports.column.farmer' },
        { key: 'holding', labelKey: 'reports.column.holding' },
        { key: 'plot', labelKey: 'reports.column.plot' },
        { key: 'crop', labelKey: 'reports.column.crop' },
        { key: 'season', labelKey: 'reports.column.season' },
        { key: 'product', labelKey: 'reports.column.product' },
        { key: 'activeIngredient', labelKey: 'reports.column.activeIngredient' },
        { key: 'target', labelKey: 'reports.column.target' },
        { key: 'treatedAreaHa', labelKey: 'reports.column.treatedArea' },
        { key: 'appliedDose', labelKey: 'reports.column.appliedDose' },
        { key: 'quantity', labelKey: 'reports.column.quantity' },
        { key: 'referenceDoseStatus', labelKey: 'reports.column.referenceDoseStatus' },
        { key: 'status', labelKey: 'reports.column.status' },
      );
      rows = view.treatments
        .filter((treatment) => {
          if (filters.holdingId && treatment.holdingId !== filters.holdingId) return false;
          if (filters.productId && treatment.productId !== filters.productId) return false;
          if (filters.cropId && treatment.cropId !== filters.cropId) return false;
          if (filters.seasonId && treatment.seasonId !== filters.seasonId) return false;
          if (filters.status && treatment.status !== filters.status) return false;
          if (!dateInRange(treatment.treatmentDate, filters.from, filters.to)) return false;
          return true;
        })
        .slice()
        .sort((a, b) => b.treatmentDate.localeCompare(a.treatmentDate))
        .map((treatment) => ({
          id: treatment.id,
          date: treatment.treatmentDate,
          farmer: farmerMap.get(treatment.farmerId)?.fullName ?? treatment.farmerId,
          holding: holdingMap.get(treatment.holdingId)?.name ?? treatment.holdingId,
          plot: plotMap.get(treatment.plotId)?.name ?? treatment.plotId,
          crop: cropMap.get(treatment.cropId)?.name ?? treatment.cropId,
          season: seasonMap.get(treatment.seasonId)?.label ?? treatment.seasonId,
          product: productMap.get(treatment.productId)?.commercialName ?? treatment.productId,
          activeIngredient: treatment.activeIngredientSnapshot,
          target: treatment.target,
          treatedAreaHa: round(treatment.treatedAreaHa),
          appliedDose: `${treatment.appliedDose} ${treatment.appliedDoseUnit}`,
          quantity: `${treatment.quantityApplied} ${treatment.quantityUnit}`,
          referenceDoseStatus: treatment.referenceDoseStatus,
          status: treatment.status,
        }));
      break;
    }

    case 'treatments-by-crop': {
      reportColumns = columns(
        { key: 'crop', labelKey: 'reports.column.crop' },
        { key: 'season', labelKey: 'reports.column.season' },
        { key: 'treatments', labelKey: 'reports.column.treatmentCount' },
        { key: 'treatedArea', labelKey: 'reports.column.treatedArea' },
        { key: 'products', labelKey: 'reports.column.productCount' },
      );
      const groups = new Map<string, { cropId: string; seasonId: string; treatments: number; area: number; products: Set<string> }>();
      for (const treatment of view.treatments) {
        if (treatment.status !== 'ACTIVE') continue;
        if (filters.holdingId && treatment.holdingId !== filters.holdingId) continue;
        if (filters.cropId && treatment.cropId !== filters.cropId) continue;
        if (filters.productId && treatment.productId !== filters.productId) continue;
        if (filters.seasonId && treatment.seasonId !== filters.seasonId) continue;
        if (!dateInRange(treatment.treatmentDate, filters.from, filters.to)) continue;
        const key = `${treatment.cropId}:${treatment.seasonId}`;
        const group =
          groups.get(key) ??
          { cropId: treatment.cropId, seasonId: treatment.seasonId, treatments: 0, area: 0, products: new Set<string>() };
        group.treatments += 1;
        group.area += treatment.treatedAreaHa;
        group.products.add(treatment.productId);
        groups.set(key, group);
      }
      rows = [...groups.values()].map((group) => ({
        crop: cropMap.get(group.cropId)?.name ?? group.cropId,
        season: seasonMap.get(group.seasonId)?.label ?? group.seasonId,
        treatments: group.treatments,
        treatedArea: round(group.area),
        products: group.products.size,
      }));
      rows.sort((a, b) => String(a.crop).localeCompare(String(b.crop)));
      break;
    }

    case 'treatments-by-product': {
      reportColumns = columns(
        { key: 'product', labelKey: 'reports.column.product' },
        { key: 'activeIngredient', labelKey: 'reports.column.activeIngredient' },
        { key: 'treatments', labelKey: 'reports.column.treatmentCount' },
        { key: 'treatedArea', labelKey: 'reports.column.treatedArea' },
        { key: 'quantity', labelKey: 'reports.column.quantity' },
      );
      const groups = new Map<string, { productId: string; treatments: number; area: number; movements: InventoryMovement[] }>();
      for (const treatment of view.treatments) {
        if (treatment.status !== 'ACTIVE') continue;
        if (filters.holdingId && treatment.holdingId !== filters.holdingId) continue;
        if (filters.productId && treatment.productId !== filters.productId) continue;
        if (filters.cropId && treatment.cropId !== filters.cropId) continue;
        if (filters.seasonId && treatment.seasonId !== filters.seasonId) continue;
        if (!dateInRange(treatment.treatmentDate, filters.from, filters.to)) continue;
        const group =
          groups.get(treatment.productId) ??
          { productId: treatment.productId, treatments: 0, area: 0, movements: [] };
        group.treatments += 1;
        group.area += treatment.treatedAreaHa;
        const linked = view.movements.find(
          (movement) =>
            movement.treatmentId === treatment.id &&
            movement.type === 'CONSUMPTION' &&
            movement.status === 'ACTIVE',
        );
        if (linked) group.movements.push(linked);
        groups.set(treatment.productId, group);
      }
      rows = [...groups.values()].map((group) => {
        const product = productMap.get(group.productId);
        return {
          product: product?.commercialName ?? group.productId,
          activeIngredient: product?.activeIngredient ?? '',
          treatments: group.treatments,
          treatedArea: round(group.area),
          quantity: quantityLabel(group.movements, product?.stockUnit ?? 'L'),
        };
      });
      rows.sort((a, b) => String(a.product).localeCompare(String(b.product)));
      break;
    }

    case 'tfi-by-crop-season': {
      reportColumns = columns(
        { key: 'crop', labelKey: 'reports.column.crop' },
        { key: 'season', labelKey: 'reports.column.season' },
        { key: 'tfi', labelKey: 'reports.column.tfi' },
        { key: 'status', labelKey: 'reports.column.calculationStatus' },
        { key: 'treatments', labelKey: 'reports.column.treatmentCount' },
        { key: 'included', labelKey: 'reports.column.includedTreatments' },
        { key: 'denominatorArea', labelKey: 'reports.column.denominatorArea' },
        { key: 'methodology', labelKey: 'reports.column.methodology' },
      );
      const pairs = new Map<string, { cropId: string; seasonId: string }>();
      for (const treatment of view.treatments) {
        if (filters.cropId && treatment.cropId !== filters.cropId) continue;
        if (filters.holdingId && treatment.holdingId !== filters.holdingId) continue;
        if (filters.productId && treatment.productId !== filters.productId) continue;
        if (filters.seasonId && treatment.seasonId !== filters.seasonId) continue;
        pairs.set(`${treatment.cropId}:${treatment.seasonId}`, {
          cropId: treatment.cropId,
          seasonId: treatment.seasonId,
        });
      }
      rows = [...pairs.values()].map(({ cropId, seasonId }) => {
        const result = calculateTFI({
          treatments: view.treatments,
          crops: view.crops,
          plots: view.plots,
          holdings: view.holdings,
          config: db.tfiConfig,
          scopeType: 'CROP',
          scopeId: cropId,
          seasonId,
          dateFrom: filters.from,
          dateTo: filters.to,
        });
        return {
          crop: cropMap.get(cropId)?.name ?? cropId,
          season: seasonMap.get(seasonId)?.label ?? seasonId,
          tfi: result.value === null ? '' : round(result.value),
          status: result.status,
          treatments: result.treatmentCount,
          included: result.includedTreatments.length,
          denominatorArea: result.denominatorAreaHa,
          methodology: `Provisional / Demo ${result.methodologyVersion}`,
        };
      });
      rows.sort((a, b) => String(a.crop).localeCompare(String(b.crop)));
      break;
    }

    case 'farmers': {
      reportColumns = columns(
        { key: 'id', labelKey: 'reports.column.farmerId' },
        { key: 'farmer', labelKey: 'reports.column.farmer' },
        { key: 'commune', labelKey: 'reports.column.commune' },
        { key: 'phone', labelKey: 'reports.column.phone' },
        { key: 'email', labelKey: 'reports.column.email' },
        { key: 'status', labelKey: 'reports.column.status' },
        { key: 'holdings', labelKey: 'reports.column.holdingCount' },
        { key: 'area', labelKey: 'reports.column.cultivatedArea' },
      );
      rows = view.farmers
        .filter((farmer) => !filters.status || farmer.status === filters.status)
        .map((farmer) => {
          const holdings = view.holdings.filter((holding) => holding.ownerFarmerId === farmer.id);
          return {
            id: farmer.id,
            farmer: farmer.fullName,
            commune: farmer.commune,
            phone: farmer.phone,
            email: farmer.email,
            status: farmer.status,
            holdings: holdings.length,
            area: round(holdings.reduce((sum, holding) => sum + holding.totalCultivatedAreaHa, 0)),
          };
        });
      rows.sort((a, b) => String(a.farmer).localeCompare(String(b.farmer)));
      break;
    }

    case 'holdings': {
      reportColumns = columns(
        { key: 'id', labelKey: 'reports.column.holdingId' },
        { key: 'holding', labelKey: 'reports.column.holding' },
        { key: 'owner', labelKey: 'reports.column.farmer' },
        { key: 'commune', labelKey: 'reports.column.commune' },
        { key: 'area', labelKey: 'reports.column.cultivatedArea' },
        { key: 'plots', labelKey: 'reports.column.plotCount' },
        { key: 'crops', labelKey: 'reports.column.cropCount' },
        { key: 'status', labelKey: 'reports.column.status' },
        { key: 'coordinates', labelKey: 'reports.column.coordinates' },
      );
      rows = view.holdings
        .filter((holding) => !filters.status || holding.status === filters.status)
        .map((holding) => ({
          id: holding.id,
          holding: holding.name,
          owner: farmerMap.get(holding.ownerFarmerId)?.fullName ?? holding.ownerFarmerId,
          commune: holding.commune,
          area: round(holding.totalCultivatedAreaHa),
          plots: view.plots.filter((plot) => plot.holdingId === holding.id).length,
          crops: view.crops.filter((crop) => crop.holdingId === holding.id).length,
          status: holding.status,
          coordinates:
            holding.latitude !== undefined && holding.longitude !== undefined
              ? `${holding.latitude.toFixed(5)}, ${holding.longitude.toFixed(5)}`
              : '',
        }));
      rows.sort((a, b) => String(a.holding).localeCompare(String(b.holding)));
      break;
    }

    case 'registrations': {
      reportColumns = columns(
        { key: 'id', labelKey: 'reports.column.registrationId' },
        { key: 'farmer', labelKey: 'reports.column.farmer' },
        { key: 'commune', labelKey: 'reports.column.commune' },
        { key: 'submitted', labelKey: 'reports.column.submittedAt' },
        { key: 'source', labelKey: 'reports.column.source' },
        { key: 'status', labelKey: 'reports.column.status' },
        { key: 'reviewedBy', labelKey: 'reports.column.reviewedBy' },
        { key: 'notes', labelKey: 'reports.column.reviewNotes' },
      );
      rows = view.registrationRequests
        .filter((request) => !filters.status || request.status === filters.status)
        .map((request) => {
          const farmer = farmerMap.get(request.farmerId);
          const reviewer = request.reviewedBy
            ? view.users.find((user) => user.id === request.reviewedBy)?.fullName ?? request.reviewedBy
            : '';
          return {
            id: request.id,
            farmer: farmer?.fullName ?? request.farmerId,
            commune: farmer?.commune ?? '',
            submitted: request.submittedAt.slice(0, 10),
            source: request.source,
            status: request.status,
            reviewedBy: reviewer,
            notes: request.reviewNotes ?? '',
          };
        });
      rows.sort((a, b) => String(b.submitted).localeCompare(String(a.submitted)));
      break;
    }

    case 'low-stock-alerts': {
      reportColumns = columns(
        { key: 'product', labelKey: 'reports.column.product' },
        { key: 'holding', labelKey: 'reports.column.holding' },
        { key: 'balance', labelKey: 'reports.column.balance' },
        { key: 'unit', labelKey: 'reports.column.unit' },
        { key: 'threshold', labelKey: 'reports.column.threshold' },
        { key: 'severity', labelKey: 'reports.column.severity' },
        { key: 'detected', labelKey: 'reports.column.detectedAt' },
      );
      rows = view.alerts
        .filter((alert) => alert.category === 'LOW_STOCK' && !alert.resolved)
        .filter((alert) => (filters.holdingId ? alert.holdingId === filters.holdingId : true))
        .filter((alert) => (filters.productId ? String(alert.data?.productId ?? '') === filters.productId : true))
        .map((alert) => ({
          product: String(alert.data?.product ?? ''),
          holding: String(alert.data?.holding ?? ''),
          balance: Number(alert.data?.balance ?? 0),
          unit: String(alert.data?.unit ?? ''),
          threshold: Number(alert.data?.threshold ?? 0),
          severity: alert.severity,
          detected: alert.createdAt.slice(0, 10),
        }));
      break;
    }

    case 'audit-logs': {
      reportColumns = columns(
        { key: 'timestamp', labelKey: 'reports.column.timestamp' },
        { key: 'actor', labelKey: 'reports.column.actor' },
        { key: 'role', labelKey: 'reports.column.role' },
        { key: 'action', labelKey: 'reports.column.action' },
        { key: 'entityType', labelKey: 'reports.column.entityType' },
        { key: 'entityId', labelKey: 'reports.column.entityId' },
        { key: 'summary', labelKey: 'reports.column.summary' },
      );
      rows = view.auditLog
        .filter((event) => {
          if (filters.from && event.timestamp.slice(0, 10) < filters.from) return false;
          if (filters.to && event.timestamp.slice(0, 10) > filters.to) return false;
          return true;
        })
        .slice()
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .map((event) => ({
          timestamp: event.timestamp,
          actor: event.actorName,
          role: event.role,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          summary: event.summary,
        }));
      break;
    }

    default:
      reportColumns = [];
      rows = [];
  }

  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value)),
  ) as Record<string, string>;

  return {
    reportType,
    titleKey: `reports.type.${reportType}.title`,
    descriptionKey: `reports.type.${reportType}.description`,
    columns: reportColumns,
    rows,
    rowCount: rows.length,
    generatedAt: new Date().toISOString(),
    filters: cleanFilters,
    demoData: true,
  };
}
