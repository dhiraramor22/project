import { Router } from 'express';
import { tfiConfigSchema, tfiRequestSchema } from '../../src/domain/schemas';
import { calculateTFI } from '../../src/domain/tfi';
import { nowIso } from '../../src/domain/ids';
import { asyncHandler, parseBody } from '../http/validation';
import type { JsonStore } from '../repositories/jsonStore';
import { requirePermission } from '../http/auth';
import { appendAudit, actorFromAuth } from '../services/audit';
import { buildScopedView } from '../services/scopedData';
import { ApiError } from '../http/errors';

export function tfiRoutes(store: JsonStore): Router {
  const router = Router();

  router.post(
    '/tfi/calculate',
    requirePermission('tfi:read'),
    asyncHandler(async (req, res) => {
      const input = parseBody(tfiRequestSchema, req.body);
      if (input.dateFrom && input.dateTo && input.dateFrom > input.dateTo) {
        throw new ApiError(400, 'INVALID_DATE_RANGE', 'The start date must not be after the end date.');
      }
      const result = await store.read((db) => {
        const auth = req.auth!;
        const view = buildScopedView(db, auth);

        if (input.scopeType === 'CROP' && input.scopeId && !view.crops.some((crop) => crop.id === input.scopeId)) {
          throw new ApiError(403, 'OUT_OF_SCOPE', 'This crop is outside your permitted scope.');
        }
        if (input.scopeType === 'PLOT' && input.scopeId && !view.plots.some((plot) => plot.id === input.scopeId)) {
          throw new ApiError(403, 'OUT_OF_SCOPE', 'This plot is outside your permitted scope.');
        }
        if (input.scopeType === 'HOLDING' && input.scopeId && !view.holdings.some((holding) => holding.id === input.scopeId)) {
          throw new ApiError(403, 'OUT_OF_SCOPE', 'This holding is outside your permitted scope.');
        }
        if (
          input.scopeType === 'TREATMENT' &&
          input.scopeId &&
          !view.treatments.some((treatment) => treatment.id === input.scopeId)
        ) {
          throw new ApiError(403, 'OUT_OF_SCOPE', 'This treatment is outside your permitted scope.');
        }
        if (
          input.scopeType === 'SEASON' &&
          input.scopeId &&
          !db.seasons.some((season) => season.id === input.scopeId)
        ) {
          throw new ApiError(404, 'SEASON_NOT_FOUND', 'Agricultural season was not found.');
        }

        return calculateTFI({
          treatments: view.treatments,
          crops: view.crops,
          plots: view.plots,
          holdings: view.holdings,
          config: db.tfiConfig,
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          seasonId: input.seasonId,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        });
      });
      res.json({ result });
    }),
  );

  router.put(
    '/tfi/config',
    requirePermission('settings:manage'),
    asyncHandler(async (req, res) => {
      const input = parseBody(tfiConfigSchema, req.body);
      const config = await store.transaction((db) => {
        db.tfiConfig = {
          ...db.tfiConfig,
          normalization: input.normalization,
          requireVerifiedDose: input.requireVerifiedDose,
          allowDemoReferenceDoses: input.allowDemoReferenceDoses,
          notes: input.notes || undefined,
          version: db.tfiConfig.version + 1,
          updatedAt: nowIso(),
          updatedBy: req.auth!.user.id,
        };
        appendAudit(
          db,
          actorFromAuth(req.auth!),
          'TFI_CONFIGURATION_UPDATED',
          'tfiConfiguration',
          db.tfiConfig.id,
          `TFI demonstration configuration updated to version ${db.tfiConfig.version}.`,
          {
            normalization: db.tfiConfig.normalization,
            requireVerifiedDose: db.tfiConfig.requireVerifiedDose,
            allowDemoReferenceDoses: db.tfiConfig.allowDemoReferenceDoses,
          },
        );
        return db.tfiConfig;
      });
      res.json({ config });
    }),
  );

  return router;
}
