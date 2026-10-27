import { Router } from 'express';
import { z } from 'zod';
import {
  farmerAdminUpdateSchema,
  farmerUpdateSchema,
  registrationSchema,
  reviewSchema,
} from '../../src/domain/schemas';
import { asyncHandler, parseBody } from '../http/validation';
import type { JsonStore } from '../repositories/jsonStore';
import { requirePermission } from '../http/auth';
import { actorFromAuth } from '../services/audit';
import {
  approveRegistration,
  createAdminFarmer,
  rejectRegistration,
  setFarmerSuspension,
  updateFarmerAdmin,
  updateFarmerSelf,
} from '../services/farmers';

const reasonSchema = z.object({ reason: z.string().trim().max(500).optional() });

export function farmerRoutes(store: JsonStore): Router {
  const router = Router();

  router.post(
    '/farmers',
    requirePermission('farmer:create'),
    asyncHandler(async (req, res) => {
      const input = parseBody(registrationSchema, req.body);
      const result = await store.transaction((db) => {
        const actor = actorFromAuth(req.auth!);
        const created = createAdminFarmer(db, actor, input);
        return {
          farmer: created.farmer,
          request: created.request,
          user: created.user,
        };
      });
      res.status(201).json(result);
    }),
  );

  router.put(
    '/farmers/me',
    requirePermission('farmer:self:manage'),
    asyncHandler(async (req, res) => {
      if (req.auth!.role !== 'FARMER') {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'This endpoint is only available to farmer profiles.' },
        });
        return;
      }
      const input = parseBody(farmerUpdateSchema, req.body);
      const farmer = await store.transaction((db) => {
        const updated = updateFarmerSelf(db, req.auth!, actorFromAuth(req.auth!), input);
        return updated;
      });
      res.json({ farmer });
    }),
  );

  router.put(
    '/farmers/:id',
    requirePermission('farmer:manage'),
    asyncHandler(async (req, res) => {
      const input = parseBody(farmerAdminUpdateSchema, req.body);
      const farmer = await store.transaction((db) => {
        const updated = updateFarmerAdmin(db, actorFromAuth(req.auth!), req.params.id, input);
        return updated;
      });
      res.json({ farmer });
    }),
  );

  router.post(
    '/farmers/:id/suspend',
    requirePermission('farmer:suspend'),
    asyncHandler(async (req, res) => {
      const body = parseBody(reasonSchema, req.body ?? {});
      const farmer = await store.transaction((db) => {
        const actor = actorFromAuth(req.auth!);
        void body;
        return setFarmerSuspension(db, actor, req.params.id, true);
      });
      res.json({ farmer });
    }),
  );

  router.post(
    '/farmers/:id/reactivate',
    requirePermission('farmer:suspend'),
    asyncHandler(async (req, res) => {
      const farmer = await store.transaction((db) =>
        setFarmerSuspension(db, actorFromAuth(req.auth!), req.params.id, false),
      );
      res.json({ farmer });
    }),
  );

  router.post(
    '/registrations/:id/approve',
    requirePermission('registration:review'),
    asyncHandler(async (req, res) => {
      const body = parseBody(reviewSchema, req.body ?? {});
      const farmer = await store.transaction((db) =>
        approveRegistration(db, actorFromAuth(req.auth!), req.params.id, body.notes),
      );
      res.json({ farmer });
    }),
  );

  router.post(
    '/registrations/:id/reject',
    requirePermission('registration:review'),
    asyncHandler(async (req, res) => {
      const body = parseBody(reviewSchema, req.body ?? {});
      const farmer = await store.transaction((db) =>
        rejectRegistration(db, actorFromAuth(req.auth!), req.params.id, body.notes),
      );
      res.json({ farmer });
    }),
  );

  return router;
}
