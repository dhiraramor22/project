import type { BootstrapPayload } from '../domain/api';
import { currentStock, summarizeStock } from '../domain/inventory';
import type {
  AgriculturalHolding,
  AgriculturalSeason,
  CropRecord,
  PesticideProduct,
  Plot,
  StockUnit,
} from '../domain/types';

export function activeSeason(data: BootstrapPayload): AgriculturalSeason | undefined {
  return data.seasons.find((season) => season.status === 'ACTIVE') ?? data.seasons[0];
}

export function productsById(data: BootstrapPayload): Map<string, PesticideProduct> {
  return new Map(data.pesticides.map((product) => [product.id, product]));
}

export function holdingsById(data: BootstrapPayload): Map<string, AgriculturalHolding> {
  return new Map(data.holdings.map((holding) => [holding.id, holding]));
}

export function plotsById(data: BootstrapPayload): Map<string, Plot> {
  return new Map(data.plots.map((plot) => [plot.id, plot]));
}

export function cropsById(data: BootstrapPayload): Map<string, CropRecord> {
  return new Map(data.crops.map((crop) => [crop.id, crop]));
}

export function farmersById(data: BootstrapPayload): Map<string, string> {
  return new Map(data.farmers.map((farmer) => [farmer.id, farmer.fullName]));
}

export function seasonsById(data: BootstrapPayload): Map<string, AgriculturalSeason> {
  return new Map(data.seasons.map((season) => [season.id, season]));
}

export interface StockLine {
  key: string;
  holdingId: string;
  holdingName: string;
  farmerId: string;
  productId: string;
  productName: string;
  unit: StockUnit;
  balance: number;
  threshold: number;
  low: boolean;
  movementCount: number;
  lastMovementAt?: string;
}

/**
 * Builds one stock line per holding/product pair that has at least one
 * movement. Balances are always derived from the transaction ledger.
 */
export function buildStockLines(data: BootstrapPayload): StockLine[] {
  const productMap = productsById(data);
  const holdingMap = holdingsById(data);
  const pairs = new Map<string, { holdingId: string; productId: string }>();
  for (const movement of data.inventoryMovements) {
    pairs.set(`${movement.holdingId}:${movement.productId}`, {
      holdingId: movement.holdingId,
      productId: movement.productId,
    });
  }

  const lines: StockLine[] = [];
  for (const pair of pairs.values()) {
    const holding = holdingMap.get(pair.holdingId);
    const product = productMap.get(pair.productId);
    if (!holding || !product) continue;
    const summary = summarizeStock(
      data.inventoryMovements,
      holding.id,
      product.id,
      product.stockUnit,
    );
    if (summary.movementCount === 0) continue;
    const lastMovement = data.inventoryMovements
      .filter(
        (movement) =>
          movement.holdingId === holding.id &&
          movement.productId === product.id &&
          movement.status === 'ACTIVE',
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
    const threshold = product.lowStockThreshold ?? data.settings.lowStockThreshold;
    lines.push({
      key: `${holding.id}:${product.id}`,
      holdingId: holding.id,
      holdingName: holding.name,
      farmerId: holding.ownerFarmerId,
      productId: product.id,
      productName: product.commercialName,
      unit: product.stockUnit,
      balance: summary.balance,
      threshold,
      low: summary.balance <= threshold,
      movementCount: summary.movementCount,
      lastMovementAt: lastMovement?.occurredAt,
    });
  }
  return lines.sort((a, b) => a.productName.localeCompare(b.productName));
}

export function stockFor(
  data: BootstrapPayload,
  holdingId: string,
  productId: string,
  unit: StockUnit,
): number {
  return currentStock(data.inventoryMovements, holdingId, productId, unit);
}

export function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

export function monthKeys(count: number, from = new Date()): string[] {
  const keys: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - index, 1));
    keys.push(date.toISOString().slice(0, 7));
  }
  return keys;
}
