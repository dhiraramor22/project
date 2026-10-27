import { Router } from 'express';
import { z } from 'zod';
import { treatmentSchema } from '../../src/domain/schemas';
import { asyncHandler, parseBody } from '../http/validation';
import type { JsonStore } from '../repositories/jsonStore';
import { requirePermission } from '../http/auth';
import { actorFromAuth } from '../services/audit';
import { createTreatment, reverseTreatment, updateTreatment } from '../services/treatments';

const reverseSchema = z.object({
  reason: z.string().trim().min(3, 'validation.required').max(500, 'validation.tooLong'),
});

export function treatmentRoutes(store: JsonStore): Router {
  const router = Router();

  router.post(
    '/treatments',
    requirePermission('treatment:write'),
    asyncHandler(async (req, res) => {
      const input = parseBody(treatmentSchema, req.body);
      const result = await store.transaction((db) =>
        createTreatment(db, req.auth!, actorFromAuth(req.auth!), input),
      );
      res.status(201).json(result);
    }),
  );

  router.put(
    '/treatments/:id',
    requirePermission('treatment:write'),
    asyncHandler(async (req, res) => {
      const input = parseBody(treatmentSchema, req.body);
      const result = await store.transaction((db) =>
        updateTreatment(db, req.auth!, actorFromAuth(req.auth!), req.params.id, input),
      );
      res.json(result);
    }),
  );

  router.post(
    '/treatments/:id/reverse',
    requirePermission('treatment:reverse'),
    asyncHandler(async (req, res) => {
      const body = parseBody(reverseSchema, req.body);
      const treatment = await store.transaction((db) =>
        reverseTreatment(db, req.auth!, actorFromAuth(req.auth!), req.params.id, body.reason),
      );
      res.json({ treatment });
    }),
  );

  return router;
}
