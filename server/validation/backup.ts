import { z } from 'zod';
import type { Database } from '../../src/domain/types';
import { COLLECTION_FILES, FILE_KEYS, createEmptyDatabase } from '../repositories/fileMap';

const looseObject = z.object({ id: z.string().min(1) }).passthrough();

const envelopeSchema = z.object({
  format: z.literal('el-oued-json-backup'),
  formatVersion: z.number().int().positive(),
  exportedAt: z.string().min(1),
  data: z.object({
    users: z.array(
      looseObject.extend({
        role: z.enum(['DSA_ADMIN', 'CHAMBER_ADMIN', 'FARMER']),
        email: z.string().min(1),
        status: z.enum(['ACTIVE', 'SUSPENDED', 'INVITED']),
      }),
    ),
    farmers: z.array(
      looseObject.extend({
        fullName: z.string().min(1),
        email: z.string().min(1),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
      }),
    ),
    registrationRequests: z.array(looseObject),
    holdings: z.array(
      looseObject.extend({
        ownerFarmerId: z.string().min(1),
        totalCultivatedAreaHa: z.number(),
      }),
    ),
    plots: z.array(looseObject),
    crops: z.array(looseObject),
    seasons: z.array(looseObject),
    pesticides: z.array(
      looseObject.extend({
        stockUnit: z.enum(['L', 'mL', 'kg', 'g']),
        commercialName: z.string().min(1),
      }),
    ),
    inventoryMovements: z.array(looseObject),
    treatments: z.array(looseObject),
    alerts: z.array(looseObject),
    auditLog: z.array(looseObject),
    tfiConfig: z.object({ id: z.string(), version: z.number() }).passthrough(),
    settings: z.object({ id: z.string(), lowStockThreshold: z.number() }).passthrough(),
  }),
});

export interface BackupValidationResult {
  ok: boolean;
  errors: string[];
  data?: Database;
  exportedAt?: string;
}

function duplicateIds(rows: Array<{ id?: string }>): string[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const row of rows) {
    if (!row.id) continue;
    if (seen.has(row.id)) duplicate.add(row.id);
    seen.add(row.id);
  }
  return [...duplicate];
}

export function validateBackupPayload(payload: unknown): BackupValidationResult {
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 20).map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    };
  }

  const data = parsed.data.data as unknown as Database;
  const errors: string[] = [];

  for (const key of FILE_KEYS) {
    if ((data as unknown as Record<string, unknown>)[key] === undefined) {
      errors.push(`Missing collection: ${COLLECTION_FILES[key]}`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const arrays = [
    'users',
    'farmers',
    'registrationRequests',
    'holdings',
    'plots',
    'crops',
    'seasons',
    'pesticides',
    'inventoryMovements',
    'treatments',
    'alerts',
    'auditLog',
  ] as const;

  for (const key of arrays) {
    const duplicates = duplicateIds(data[key] as Array<{ id?: string }>);
    if (duplicates.length > 0) {
      errors.push(`${COLLECTION_FILES[key]}: duplicate IDs (${duplicates.slice(0, 5).join(', ')})`);
    }
  }

  const farmerIds = new Set(data.farmers.map((row) => row.id));
  const userIds = new Set(data.users.map((row) => row.id));
  const holdingIds = new Set(data.holdings.map((row) => row.id));
  const plotIds = new Set(data.plots.map((row) => row.id));
  const cropIds = new Set(data.crops.map((row) => row.id));
  const seasonIds = new Set(data.seasons.map((row) => row.id));
  const productIds = new Set(data.pesticides.map((row) => row.id));
  const movementIds = new Set(data.inventoryMovements.map((row) => row.id));

  for (const user of data.users) {
    if (user.farmerId && !farmerIds.has(user.farmerId)) {
      errors.push(`User ${user.id} references unknown farmer ${user.farmerId}`);
    }
    if (user.role === 'FARMER' && !user.farmerId) {
      errors.push(`Farmer user ${user.id} has no farmerId`);
    }
  }
  for (const farmer of data.farmers) {
    if (farmer.userId && !userIds.has(farmer.userId)) {
      errors.push(`Farmer ${farmer.id} references unknown user ${farmer.userId}`);
    }
  }
  for (const request of data.registrationRequests) {
    if (!farmerIds.has(request.farmerId)) {
      errors.push(`Registration ${request.id} references unknown farmer ${request.farmerId}`);
    }
  }
  for (const holding of data.holdings) {
    if (!farmerIds.has(holding.ownerFarmerId)) {
      errors.push(`Holding ${holding.id} references unknown farmer ${holding.ownerFarmerId}`);
    }
  }
  for (const plot of data.plots) {
    if (!holdingIds.has(plot.holdingId)) {
      errors.push(`Plot ${plot.id} references unknown holding ${plot.holdingId}`);
    }
  }
  for (const crop of data.crops) {
    if (!holdingIds.has(crop.holdingId)) errors.push(`Crop ${crop.id}: unknown holding`);
    if (!plotIds.has(crop.plotId)) errors.push(`Crop ${crop.id}: unknown plot`);
    if (!farmerIds.has(crop.farmerId)) errors.push(`Crop ${crop.id}: unknown farmer`);
    if (!seasonIds.has(crop.seasonId)) errors.push(`Crop ${crop.id}: unknown season`);
  }
  for (const movement of data.inventoryMovements) {
    if (!holdingIds.has(movement.holdingId)) errors.push(`Movement ${movement.id}: unknown holding`);
    if (!farmerIds.has(movement.farmerId)) errors.push(`Movement ${movement.id}: unknown farmer`);
    if (!productIds.has(movement.productId)) errors.push(`Movement ${movement.id}: unknown product`);
  }
  for (const treatment of data.treatments) {
    if (!holdingIds.has(treatment.holdingId)) errors.push(`Treatment ${treatment.id}: unknown holding`);
    if (!plotIds.has(treatment.plotId)) errors.push(`Treatment ${treatment.id}: unknown plot`);
    if (!cropIds.has(treatment.cropId)) errors.push(`Treatment ${treatment.id}: unknown crop`);
    if (!seasonIds.has(treatment.seasonId)) errors.push(`Treatment ${treatment.id}: unknown season`);
    if (!productIds.has(treatment.productId)) errors.push(`Treatment ${treatment.id}: unknown product`);
    if (treatment.consumptionMovementId && !movementIds.has(treatment.consumptionMovementId)) {
      errors.push(`Treatment ${treatment.id}: unknown consumption movement`);
    }
  }
  if (!data.users.some((user) => user.role === 'DSA_ADMIN' && user.status === 'ACTIVE')) {
    errors.push('The backup must contain at least one active DSA administrator to avoid locking the application.');
  }

  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 50) };

  const db: Database = { ...createEmptyDatabase(), ...data };
  return { ok: true, errors: [], data: db, exportedAt: parsed.data.exportedAt };
}
