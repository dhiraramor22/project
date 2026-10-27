import { Router } from 'express';
import { z } from 'zod';
import { nowIso } from '../../src/domain/ids';
import type { Alert } from '../../src/domain/types';
import { asyncHandler, parseBody } from '../http/validation';
import type { JsonStore } from '../repositories/jsonStore';
import { requirePermission } from '../http/auth';
import { appendAudit, actorFromAuth } from '../services/audit';
import { buildScopedView } from '../services/scopedData';
import { ApiError } from '../http/errors';

const resolveSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export function alertRoutes(store: JsonStore): Router {
  const router = Router();

  router.post(
    '/alerts/read-all',
    requirePermission('alert:read'),
    asyncHandler(async (req, res) => {
      const count = await store.transaction((db) => {
        const view = buildScopedView(db, req.auth!);
        const ids = new Set(view.alerts.map((alert) => alert.id));
        let updated = 0;
        for (const alert of db.alerts) {
          if (ids.has(alert.id) && !alert.read) {
            alert.read = true;
            alert.updatedAt = nowIso();
            updated += 1;
          }
        }
        return updated;
      });
      res.json({ updated: count });
    }),
  );

  router.post(
    '/alerts/:id/read',
    requirePermission('alert:read'),
    asyncHandler(async (req, res) => {
      const alert = await store.transaction((db) => {
        const view = buildScopedView(db, req.auth!);
        if (!view.alerts.some((item) => item.id === req.params.id)) {
          throw new ApiError(404, 'ALERT_NOT_FOUND', 'Alert was not found in your permitted scope.');
        }
        const found = db.alerts.find((item) => item.id === req.params.id);
        if (!found) throw new ApiError(404, 'ALERT_NOT_FOUND', 'Alert was not found.');
        found.read = true;
        found.updatedAt = nowIso();
        return found;
      });
      res.json({ alert });
    }),
  );

  router.post(
    '/alerts/:id/resolve',
    requirePermission('alert:read'),
    asyncHandler(async (req, res) => {
      const body = parseBody(resolveSchema, req.body ?? {});
      const alert = await store.transaction((db) => {
        const view = buildScopedView(db, req.auth!);
        if (!view.alerts.some((item) => item.id === req.params.id)) {
          throw new ApiError(404, 'ALERT_NOT_FOUND', 'Alert was not found in your permitted scope.');
        }
        const found = db.alerts.find((item) => item.id === req.params.id) as Alert | undefined;
        if (!found) throw new ApiError(404, 'ALERT_NOT_FOUND', 'Alert was not found.');
        found.resolved = true;
        found.resolvedAt = nowIso();
        found.updatedAt = nowIso();
        found.read = true;
        appendAudit(
          db,
          actorFromAuth(req.auth!),
          'ALERT_RESOLVED',
          'alert',
          found.id,
          `Alert ${found.category} marked resolved.${body.notes ? ` Notes: ${body.notes}` : ''}`,
          { category: found.category, entityId: found.entityId },
        );
        return found;
      });
      res.json({ alert });
    }),
  );

  return router;
}
