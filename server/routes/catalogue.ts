import { Router } from 'express';
import { z } from 'zod';
import { productSchema } from '../../src/domain/schemas';
import { makeId, nowIso } from '../../src/domain/ids';
import type { PesticideProduct } from '../../src/domain/types';
import { asyncHandler, parseBody } from '../http/validation';
import type { JsonStore } from '../repositories/jsonStore';
import { requirePermission } from '../http/auth';
import { appendAudit, actorFromAuth } from '../services/audit';
import { ApiError } from '../http/errors';
import { syncAlerts } from '../services/alerts';

const archiveSchema = z.object({ archived: z.boolean() });

export function catalogueRoutes(store: JsonStore): Router {
  const router = Router();

  router.post(
    '/pesticides',
    requirePermission('catalogue:manage'),
    asyncHandler(async (req, res) => {
      const input = parseBody(productSchema, req.body);
      const product = await store.transaction((db) => {
        if (
          db.pesticides.some(
            (item) =>
              item.commercialName.toLowerCase() === input.commercialName.toLowerCase() &&
              !item.archived,
          )
        ) {
          throw new ApiError(409, 'PRODUCT_NAME_EXISTS', 'An active product with this commercial name already exists.');
        }
        const now = nowIso();
        const created: PesticideProduct = {
          id: makeId('PST'),
          commercialName: input.commercialName,
          activeIngredient: input.activeIngredient,
          category: input.category,
          formulation: input.formulation,
          manufacturer: input.manufacturer,
          registrationReference: input.registrationReference || undefined,
          intendedCrops: input.intendedCrops,
          targetPests: input.targetPests,
          referenceDose: input.referenceDose,
          referenceDoseUnit: input.referenceDoseUnit,
          referenceSource: input.referenceSource || undefined,
          safetyInfo: input.safetyInfo,
          preHarvestIntervalDays: input.preHarvestIntervalDays,
          reEntryIntervalHours: input.reEntryIntervalHours,
          stockUnit: input.stockUnit,
          lowStockThreshold: input.lowStockThreshold,
          verificationStatus: input.verificationStatus,
          archived: input.archived ?? false,
          createdAt: now,
          updatedAt: now,
        };
        db.pesticides.push(created);
        appendAudit(
          db,
          actorFromAuth(req.auth!),
          'PRODUCT_CREATED',
          'pesticide',
          created.id,
          `Pesticide product "${created.commercialName}" added to the catalogue (${created.verificationStatus}).`,
          {
            verificationStatus: created.verificationStatus,
            referenceDose: created.referenceDose ?? null,
            referenceDoseUnit: created.referenceDoseUnit ?? null,
          },
        );
        syncAlerts(db);
        return created;
      });
      res.status(201).json({ product });
    }),
  );

  router.put(
    '/pesticides/:id',
    requirePermission('catalogue:manage'),
    asyncHandler(async (req, res) => {
      const input = parseBody(productSchema, req.body);
      const product = await store.transaction((db) => {
        const existing = db.pesticides.find((item) => item.id === req.params.id);
        if (!existing) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Pesticide product was not found.');
        if (
          db.pesticides.some(
            (item) =>
              item.id !== existing.id &&
              !item.archived &&
              item.commercialName.toLowerCase() === input.commercialName.toLowerCase(),
          )
        ) {
          throw new ApiError(409, 'PRODUCT_NAME_EXISTS', 'An active product with this commercial name already exists.');
        }
        Object.assign(existing, {
          commercialName: input.commercialName,
          activeIngredient: input.activeIngredient,
          category: input.category,
          formulation: input.formulation,
          manufacturer: input.manufacturer,
          registrationReference: input.registrationReference || undefined,
          intendedCrops: input.intendedCrops,
          targetPests: input.targetPests,
          referenceDose: input.referenceDose,
          referenceDoseUnit: input.referenceDoseUnit,
          referenceSource: input.referenceSource || undefined,
          safetyInfo: input.safetyInfo,
          preHarvestIntervalDays: input.preHarvestIntervalDays,
          reEntryIntervalHours: input.reEntryIntervalHours,
          stockUnit: input.stockUnit,
          lowStockThreshold: input.lowStockThreshold,
          verificationStatus: input.verificationStatus,
          archived: input.archived ?? existing.archived,
          updatedAt: nowIso(),
        });
        appendAudit(
          db,
          actorFromAuth(req.auth!),
          'PRODUCT_UPDATED',
          'pesticide',
          existing.id,
          `Pesticide product "${existing.commercialName}" updated.`,
          {
            verificationStatus: existing.verificationStatus,
            referenceDose: existing.referenceDose ?? null,
            referenceDoseUnit: existing.referenceDoseUnit ?? null,
          },
        );
        syncAlerts(db);
        return existing;
      });
      res.json({ product });
    }),
  );

  router.post(
    '/pesticides/:id/archive',
    requirePermission('catalogue:manage'),
    asyncHandler(async (req, res) => {
      const body = parseBody(archiveSchema, req.body ?? {});
      const product = await store.transaction((db) => {
        const existing = db.pesticides.find((item) => item.id === req.params.id);
        if (!existing) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Pesticide product was not found.');
        existing.archived = body.archived;
        existing.updatedAt = nowIso();
        appendAudit(
          db,
          actorFromAuth(req.auth!),
          body.archived ? 'PRODUCT_ARCHIVED' : 'PRODUCT_UNARCHIVED',
          'pesticide',
          existing.id,
          `Pesticide product "${existing.commercialName}" ${body.archived ? 'archived' : 'restored'}.`,
          { archived: body.archived },
        );
        syncAlerts(db);
        return existing;
      });
      res.json({ product });
    }),
  );

  return router;
}
