import { Router } from 'express';
import { settingsSchema } from '../../src/domain/schemas';
import { nowIso } from '../../src/domain/ids';
import { asyncHandler, parseBody } from '../http/validation';
import type { JsonStore } from '../repositories/jsonStore';
import { requirePermission } from '../http/auth';
import { appendAudit, actorFromAuth } from '../services/audit';
import { syncAlerts } from '../services/alerts';

export function settingsRoutes(store: JsonStore): Router {
  const router = Router();

  router.put(
    '/settings',
    requirePermission('settings:manage'),
    asyncHandler(async (req, res) => {
      const input = parseBody(settingsSchema, req.body);
      const settings = await store.transaction((db) => {
        Object.assign(db.settings, {
          applicationName: input.applicationName,
          institution: input.institution,
          lowStockThreshold: input.lowStockThreshold,
          allowSelfRegistration: input.allowSelfRegistration,
          defaultLanguage: input.defaultLanguage,
          communes: input.communes,
          cropCategories: input.cropCategories,
          cropSuggestions: input.cropSuggestions,
          updatedAt: nowIso(),
        });
        appendAudit(
          db,
          actorFromAuth(req.auth!),
          'SETTINGS_UPDATED',
          'settings',
          db.settings.id,
          'Application settings updated.',
          {
            lowStockThreshold: db.settings.lowStockThreshold,
            allowSelfRegistration: db.settings.allowSelfRegistration,
            communeCount: db.settings.communes.length,
          },
        );
        syncAlerts(db);
        return db.settings;
      });
      res.json({ settings });
    }),
  );

  return router;
}
