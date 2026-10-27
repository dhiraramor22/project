import { Router } from 'express';
import { z } from 'zod';
import { movementSchema } from '../../src/domain/schemas';
import { asyncHandler, parseBody } from '../http/validation';
import type { JsonStore } from '../repositories/jsonStore';
import { requirePermission } from '../http/auth';
import { actorFromAuth } from '../services/audit';
import { createInventoryMovement, reverseInventoryMovement } from '../services/inventory';

const reverseSchema = z.object({
  reason: z.string().trim().min(3, 'validation.required').max(500, 'validation.tooLong'),
});

export function inventoryRoutes(store: JsonStore): Router {
  const router = Router();

  router.post(
    '/inventory-movements',
    requirePermission('inventory:write'),
    asyncHandler(async (req, res) => {
      const input = parseBody(movementSchema, req.body);
      const result = await store.transaction((db) =>
        createInventoryMovement(db, req.auth!, actorFromAuth(req.auth!), input),
      );
      res.status(201).json(result);
    }),
  );

  router.post(
    '/inventory-movements/:id/reverse',
    requirePermission('inventory:write'),
    asyncHandler(async (req, res) => {
      const body = parseBody(reverseSchema, req.body);
      const movement = await store.transaction((db) =>
        reverseInventoryMovement(db, req.auth!, actorFromAuth(req.auth!), req.params.id, body.reason),
      );
      res.json({ movement });
    }),
  );

  return router;
}
