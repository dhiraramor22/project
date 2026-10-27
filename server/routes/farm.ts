import { Router } from 'express';
import { z } from 'zod';
import {
  cropSchema,
  holdingSchema,
  plotSchema,
  seasonSchema,
} from '../../src/domain/schemas';
import { makeId, nowIso } from '../../src/domain/ids';
import type { Database } from '../../src/domain/types';
import { asyncHandler, parseBody } from '../http/validation';
import type { JsonStore } from '../repositories/jsonStore';
import { requirePermission } from '../http/auth';
import { appendAudit, actorFromAuth } from '../services/audit';
import { assertHoldingAccess } from '../services/access';
import { ApiError } from '../http/errors';
import { syncAlerts } from '../services/alerts';

const plotCreateSchema = plotSchema.extend({
  holdingId: z.string().trim().min(1, 'validation.required'),
});

const plotUpdateSchema = plotSchema;

function holdingForPlot(db: Database, plotId: string) {
  const plot = db.plots.find((item) => item.id === plotId);
  if (!plot) throw new ApiError(404, 'PLOT_NOT_FOUND', 'Plot was not found.');
  const holding = db.holdings.find((item) => item.id === plot.holdingId);
  if (!holding) throw new ApiError(404, 'HOLDING_NOT_FOUND', 'Agricultural holding was not found.');
  return { plot, holding };
}

function areaWarnings(db: Database, holdingId: string, plotId?: string): string[] {
  const warnings: string[] = [];
  const holding = db.holdings.find((item) => item.id === holdingId);
  if (!holding) return warnings;
  const plotTotal = db.plots
    .filter((plot) => plot.holdingId === holdingId)
    .reduce((sum, plot) => sum + plot.areaHa, 0);
  if (plotTotal > holding.totalCultivatedAreaHa + 0.0001) {
    warnings.push('PLOT_AREA_EXCEEDS_HOLDING');
  }
  if (plotId) {
    const plot = db.plots.find((item) => item.id === plotId);
    if (plot) {
      const cropTotal = db.crops
        .filter((crop) => crop.plotId === plotId)
        .reduce((sum, crop) => sum + crop.areaHa, 0);
      if (cropTotal > plot.areaHa + 0.0001) warnings.push('CROP_AREA_EXCEEDS_PLOT');
    }
  }
  return warnings;
}

export function farmRoutes(store: JsonStore): Router {
  const router = Router();

  router.post(
    '/holdings',
    requirePermission('holding:write'),
    asyncHandler(async (req, res) => {
      const input = parseBody(holdingSchema, req.body);
      const result = await store.transaction((db) => {
        const auth = req.auth!;
        const actor = actorFromAuth(auth);
        let ownerFarmerId: string;
        if (auth.role === 'FARMER') {
          if (!auth.farmerId) throw new ApiError(403, 'NO_FARMER_PROFILE', 'No farmer profile is linked to this account.');
          if (input.ownerFarmerId && input.ownerFarmerId !== auth.farmerId) {
            throw new ApiError(403, 'OUT_OF_SCOPE', 'You can only create holdings for your own profile.');
          }
          ownerFarmerId = auth.farmerId;
        } else {
          if (!input.ownerFarmerId) {
            throw new ApiError(400, 'OWNER_REQUIRED', 'An owner farmer is required when an administrator creates a holding.');
          }
          ownerFarmerId = input.ownerFarmerId;
        }
        const farmer = db.farmers.find((item) => item.id === ownerFarmerId);
        if (!farmer) throw new ApiError(404, 'FARMER_NOT_FOUND', 'Owner farmer was not found.');
        if (farmer.status !== 'APPROVED') {
          throw new ApiError(409, 'FARMER_NOT_APPROVED', 'Holdings can only be created for approved farmers.');
        }
        const now = nowIso();
        const holding = {
          id: makeId('HLD'),
          name: input.name,
          ownerFarmerId,
          wilaya: db.settings.wilaya,
          commune: input.commune,
          address: input.address || undefined,
          latitude: input.latitude,
          longitude: input.longitude,
          totalCultivatedAreaHa: input.totalCultivatedAreaHa,
          status: input.status ?? 'ACTIVE' as const,
          coordinatesAreDemo:
            input.latitude !== undefined && input.longitude !== undefined ? auth.user.demo : undefined,
          createdAt: now,
          updatedAt: now,
        };
        db.holdings.push(holding);
        appendAudit(
          db,
          actor,
          'HOLDING_CREATED',
          'holding',
          holding.id,
          `Holding "${holding.name}" created for ${farmer.fullName} in ${holding.commune}.`,
          { farmerId: ownerFarmerId, areaHa: holding.totalCultivatedAreaHa },
        );
        syncAlerts(db);
        return { holding, warnings: areaWarnings(db, holding.id) };
      });
      res.status(201).json(result);
    }),
  );

  router.put(
    '/holdings/:id',
    requirePermission('holding:write'),
    asyncHandler(async (req, res) => {
      const input = parseBody(holdingSchema, req.body);
      const result = await store.transaction((db) => {
        const auth = req.auth!;
        const holding = db.holdings.find((item) => item.id === req.params.id);
        if (!holding) throw new ApiError(404, 'HOLDING_NOT_FOUND', 'Agricultural holding was not found.');
        assertHoldingAccess(auth, holding);
        if (auth.role === 'FARMER' && holding.ownerFarmerId !== auth.farmerId) {
          throw new ApiError(403, 'OUT_OF_SCOPE', 'You can only edit your own holding.');
        }
        if (input.ownerFarmerId && input.ownerFarmerId !== holding.ownerFarmerId) {
          throw new ApiError(409, 'OWNER_IMMUTABLE', 'The owner of an existing holding cannot be changed.');
        }
        Object.assign(holding, {
          name: input.name,
          commune: input.commune,
          address: input.address || undefined,
          latitude: input.latitude,
          longitude: input.longitude,
          totalCultivatedAreaHa: input.totalCultivatedAreaHa,
          status: input.status ?? holding.status,
          coordinatesAreDemo:
            input.latitude !== undefined && input.longitude !== undefined ? auth.user.demo : undefined,
          updatedAt: nowIso(),
        });
        appendAudit(
          db,
          actorFromAuth(auth),
          'HOLDING_UPDATED',
          'holding',
          holding.id,
          `Holding "${holding.name}" updated.`,
          { farmerId: holding.ownerFarmerId },
        );
        syncAlerts(db);
        return { holding, warnings: areaWarnings(db, holding.id) };
      });
      res.json(result);
    }),
  );

  router.post(
    '/plots',
    requirePermission('holding:write'),
    asyncHandler(async (req, res) => {
      const input = parseBody(plotCreateSchema, req.body);
      const result = await store.transaction((db) => {
        const auth = req.auth!;
        const holding = db.holdings.find((item) => item.id === input.holdingId);
        if (!holding) throw new ApiError(404, 'HOLDING_NOT_FOUND', 'Agricultural holding was not found.');
        assertHoldingAccess(auth, holding);
        if (auth.role === 'FARMER' && holding.ownerFarmerId !== auth.farmerId) {
          throw new ApiError(403, 'OUT_OF_SCOPE', 'You can only add plots to your own holding.');
        }
        const now = nowIso();
        const plot = {
          id: makeId('PLT'),
          holdingId: holding.id,
          name: input.name,
          areaHa: input.areaHa,
          soilType: input.soilType || undefined,
          notes: input.notes || undefined,
          createdAt: now,
          updatedAt: now,
        };
        db.plots.push(plot);
        appendAudit(
          db,
          actorFromAuth(auth),
          'PLOT_CREATED',
          'plot',
          plot.id,
          `Plot "${plot.name}" (${plot.areaHa} ha) added to ${holding.name}.`,
          { holdingId: holding.id, areaHa: plot.areaHa },
        );
        return { plot, warnings: areaWarnings(db, holding.id, plot.id) };
      });
      res.status(201).json(result);
    }),
  );

  router.put(
    '/plots/:id',
    requirePermission('holding:write'),
    asyncHandler(async (req, res) => {
      const input = parseBody(plotUpdateSchema, req.body);
      const result = await store.transaction((db) => {
        const auth = req.auth!;
        const plot = db.plots.find((item) => item.id === req.params.id);
        if (!plot) throw new ApiError(404, 'PLOT_NOT_FOUND', 'Plot was not found.');
        const holding = db.holdings.find((item) => item.id === plot.holdingId);
        if (!holding) throw new ApiError(404, 'HOLDING_NOT_FOUND', 'Agricultural holding was not found.');
        assertHoldingAccess(auth, holding);
        if (auth.role === 'FARMER' && holding.ownerFarmerId !== auth.farmerId) {
          throw new ApiError(403, 'OUT_OF_SCOPE', 'You can only edit plots on your own holding.');
        }
        Object.assign(plot, {
          name: input.name,
          areaHa: input.areaHa,
          soilType: input.soilType || undefined,
          notes: input.notes || undefined,
          updatedAt: nowIso(),
        });
        appendAudit(
          db,
          actorFromAuth(auth),
          'PLOT_UPDATED',
          'plot',
          plot.id,
          `Plot "${plot.name}" updated.`,
          { holdingId: holding.id, areaHa: plot.areaHa },
        );
        return { plot, warnings: areaWarnings(db, holding.id, plot.id) };
      });
      res.json(result);
    }),
  );

  router.post(
    '/crops',
    requirePermission('holding:write'),
    asyncHandler(async (req, res) => {
      const input = parseBody(cropSchema, req.body);
      const result = await store.transaction((db) => {
        const auth = req.auth!;
        const { plot, holding } = holdingForPlot(db, input.plotId);
        assertHoldingAccess(auth, holding);
        if (auth.role === 'FARMER' && holding.ownerFarmerId !== auth.farmerId) {
          throw new ApiError(403, 'OUT_OF_SCOPE', 'You can only add crops to your own holding.');
        }
        const season = db.seasons.find((item) => item.id === input.seasonId);
        if (!season) throw new ApiError(404, 'SEASON_NOT_FOUND', 'Agricultural season was not found.');
        const now = nowIso();
        const crop = {
          id: makeId('CRP'),
          holdingId: holding.id,
          plotId: plot.id,
          farmerId: holding.ownerFarmerId,
          name: input.name,
          category: input.category,
          seasonId: input.seasonId,
          areaHa: input.areaHa,
          plantingDate: input.plantingDate || undefined,
          harvestDate: input.harvestDate || undefined,
          notes: input.notes || undefined,
          createdAt: now,
          updatedAt: now,
        };
        db.crops.push(crop);
        appendAudit(
          db,
          actorFromAuth(auth),
          'CROP_CREATED',
          'crop',
          crop.id,
          `Crop "${crop.name}" (${crop.areaHa} ha) added to plot ${plot.name} for ${season.label}.`,
          { holdingId: holding.id, plotId: plot.id, seasonId: season.id },
        );
        syncAlerts(db);
        return { crop, warnings: areaWarnings(db, holding.id, plot.id) };
      });
      res.status(201).json(result);
    }),
  );

  router.put(
    '/crops/:id',
    requirePermission('holding:write'),
    asyncHandler(async (req, res) => {
      const input = parseBody(cropSchema, req.body);
      const result = await store.transaction((db) => {
        const auth = req.auth!;
        const crop = db.crops.find((item) => item.id === req.params.id);
        if (!crop) throw new ApiError(404, 'CROP_NOT_FOUND', 'Crop record was not found.');
        const holding = db.holdings.find((item) => item.id === crop.holdingId);
        if (!holding) throw new ApiError(404, 'HOLDING_NOT_FOUND', 'Agricultural holding was not found.');
        assertHoldingAccess(auth, holding);
        if (auth.role === 'FARMER' && holding.ownerFarmerId !== auth.farmerId) {
          throw new ApiError(403, 'OUT_OF_SCOPE', 'You can only edit crops on your own holding.');
        }
        const plot = db.plots.find((item) => item.id === input.plotId);
        if (!plot || plot.holdingId !== holding.id) {
          throw new ApiError(400, 'PLOT_HOLDING_MISMATCH', 'The selected plot does not belong to this holding.');
        }
        const season = db.seasons.find((item) => item.id === input.seasonId);
        if (!season) throw new ApiError(404, 'SEASON_NOT_FOUND', 'Agricultural season was not found.');
        Object.assign(crop, {
          plotId: input.plotId,
          seasonId: input.seasonId,
          name: input.name,
          category: input.category,
          areaHa: input.areaHa,
          plantingDate: input.plantingDate || undefined,
          harvestDate: input.harvestDate || undefined,
          notes: input.notes || undefined,
          updatedAt: nowIso(),
        });
        appendAudit(
          db,
          actorFromAuth(auth),
          'CROP_UPDATED',
          'crop',
          crop.id,
          `Crop "${crop.name}" updated.`,
          { holdingId: holding.id, plotId: plot.id, seasonId: season.id },
        );
        syncAlerts(db);
        return { crop, warnings: areaWarnings(db, holding.id, plot.id) };
      });
      res.json(result);
    }),
  );

  router.delete(
    '/crops/:id',
    requirePermission('holding:write'),
    asyncHandler(async (req, res) => {
      const result = await store.transaction((db) => {
        const auth = req.auth!;
        const crop = db.crops.find((item) => item.id === req.params.id);
        if (!crop) throw new ApiError(404, 'CROP_NOT_FOUND', 'Crop record was not found.');
        const holding = db.holdings.find((item) => item.id === crop.holdingId);
        if (!holding) throw new ApiError(404, 'HOLDING_NOT_FOUND', 'Agricultural holding was not found.');
        assertHoldingAccess(auth, holding);
        if (auth.role === 'FARMER' && holding.ownerFarmerId !== auth.farmerId) {
          throw new ApiError(403, 'OUT_OF_SCOPE', 'You can only delete crops on your own holding.');
        }
        if (db.treatments.some((treatment) => treatment.cropId === crop.id)) {
          throw new ApiError(
            409,
            'CROP_HAS_TREATMENTS',
            'This crop has treatment records. Reverse those treatments before deleting the crop.',
          );
        }
        db.crops = db.crops.filter((item) => item.id !== crop.id);
        appendAudit(
          db,
          actorFromAuth(auth),
          'CROP_DELETED',
          'crop',
          crop.id,
          `Crop "${crop.name}" deleted.`,
          { holdingId: holding.id },
        );
        syncAlerts(db);
        return { deleted: true };
      });
      res.json(result);
    }),
  );

  router.post(
    '/seasons',
    requirePermission('settings:manage'),
    asyncHandler(async (req, res) => {
      const input = parseBody(seasonSchema, req.body);
      const season = await store.transaction((db) => {
        if (db.seasons.some((item) => item.label.toLowerCase() === input.label.toLowerCase())) {
          throw new ApiError(409, 'SEASON_EXISTS', 'A season with this label already exists.');
        }
        const created = { id: makeId('SSN'), ...input };
        db.seasons.push(created);
        appendAudit(
          db,
          actorFromAuth(req.auth!),
          'SEASON_CREATED',
          'season',
          created.id,
          `Agricultural season "${created.label}" created.`,
          { startDate: created.startDate, endDate: created.endDate },
        );
        return created;
      });
      res.status(201).json({ season });
    }),
  );

  router.put(
    '/seasons/:id',
    requirePermission('settings:manage'),
    asyncHandler(async (req, res) => {
      const input = parseBody(seasonSchema, req.body);
      const season = await store.transaction((db) => {
        const existing = db.seasons.find((item) => item.id === req.params.id);
        if (!existing) throw new ApiError(404, 'SEASON_NOT_FOUND', 'Agricultural season was not found.');
        Object.assign(existing, input);
        appendAudit(
          db,
          actorFromAuth(req.auth!),
          'SEASON_UPDATED',
          'season',
          existing.id,
          `Agricultural season "${existing.label}" updated.`,
          { startDate: existing.startDate, endDate: existing.endDate, status: existing.status },
        );
        return existing;
      });
      res.json({ season });
    }),
  );

  return router;
}
