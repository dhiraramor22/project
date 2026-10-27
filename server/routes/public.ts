import { Router } from 'express';
import { z } from 'zod';
import { registrationSchema } from '../../src/domain/schemas';
import { nowIso } from '../../src/domain/ids';
import type { JsonStore } from '../repositories/jsonStore';
import { ApiError } from '../http/errors';
import { asyncHandler, parseBody } from '../http/validation';
import { appendAudit } from '../services/audit';
import { createSelfRegistration } from '../services/farmers';
import { permissionsForRole } from '../../src/domain/permissions';

const demoSessionSchema = z.object({
  userId: z.string().trim().min(1),
});

export function publicRoutes(store: JsonStore): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'el-oued-local-json-service',
      storage: 'local JSON files',
      timestamp: nowIso(),
    });
  });

  router.get(
    '/public-config',
    asyncHandler(async (_req, res) => {
      const snapshot = await store.snapshot();
      res.json({
        applicationName: snapshot.settings.applicationName,
        institution: snapshot.settings.institution,
        province: snapshot.settings.province,
        wilaya: snapshot.settings.wilaya,
        defaultLanguage: snapshot.settings.defaultLanguage,
        allowSelfRegistration: snapshot.settings.allowSelfRegistration,
        demoMode: snapshot.settings.demoMode,
        communes: snapshot.settings.communes,
        cropSuggestions: snapshot.settings.cropSuggestions,
        cropCategories: snapshot.settings.cropCategories,
        demoUsers: snapshot.users
          .filter((user) => user.demo && user.status !== 'SUSPENDED')
          .map((user) => ({
            id: user.id,
            fullName: user.fullName,
            role: user.role,
            farmerId: user.farmerId,
            scopeCommunes: user.scopeCommunes,
            permissions: permissionsForRole(user.role),
          })),
      });
    }),
  );

  router.post(
    '/session/demo',
    asyncHandler(async (req, res) => {
      const body = parseBody(demoSessionSchema, req.body);
      const user = await store.transaction(async (db) => {
        const found = db.users.find((item) => item.id === body.userId);
        if (!found) throw new ApiError(404, 'DEMO_USER_NOT_FOUND', 'Demo user was not found.');
        if (!found.demo) {
          throw new ApiError(403, 'NOT_A_DEMO_USER', 'Only demo identities can be selected without credentials.');
        }
        if (found.status === 'SUSPENDED') {
          throw new ApiError(403, 'USER_SUSPENDED', 'This demo account is suspended.');
        }
        appendAudit(
          db,
          { id: found.id, name: found.fullName, role: found.role },
          'DEMO_SESSION_STARTED',
          'user',
          found.id,
          `Demo session started as ${found.role}. This is a role simulation, not secure authentication.`,
          { role: found.role },
        );
        return found;
      });
      res.json({
        user,
        role: user.role,
        permissions: permissionsForRole(user.role),
        notice: 'Demo session only. No password is used and this is not secure authentication.',
      });
    }),
  );

  router.post(
    '/registrations/public',
    asyncHandler(async (req, res) => {
      const input = parseBody(registrationSchema, req.body);
      const result = await store.transaction(async (db) => {
        const created = createSelfRegistration(db, input);
        return {
          farmerId: created.farmer.id,
          requestId: created.request.id,
          status: created.farmer.status,
          submittedAt: created.request.submittedAt,
        };
      });
      res.status(201).json({
        ...result,
        message:
          'Registration submitted. A DSA administrator must review it before the farmer account becomes active.',
      });
    }),
  );

  return router;
}
