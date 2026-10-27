import { Router } from 'express';
import type { BootstrapPayload } from '../../src/domain/api';
import { nowIso } from '../../src/domain/ids';
import { permissionsForRole } from '../../src/domain/permissions';
import { asyncHandler } from '../http/validation';
import type { JsonStore } from '../repositories/jsonStore';
import { buildScopedView } from '../services/scopedData';

export function bootstrapRoutes(store: JsonStore): Router {
  const router = Router();

  router.get(
    '/bootstrap',
    asyncHandler(async (req, res) => {
      const auth = req.auth!;
      const payload = await store.read((db): BootstrapPayload => {
        const view = buildScopedView(db, auth);
        return {
          user: auth.user,
          role: auth.role,
          permissions: auth.permissions,
          farmerId: auth.farmerId,
          scopeCommunes: auth.scopeCommunes,
          settings: db.settings,
          tfiConfig: db.tfiConfig,
          users: view.users,
          demoUsers: db.users
            .filter((user) => user.demo && user.status !== 'SUSPENDED')
            .map((user) => ({
              id: user.id,
              fullName: user.fullName,
              role: user.role,
              farmerId: user.farmerId,
              scopeCommunes: user.scopeCommunes,
              permissions: permissionsForRole(user.role),
            })),
          farmers: view.farmers,
          holdings: view.holdings,
          plots: view.plots,
          crops: view.crops,
          seasons: db.seasons,
          pesticides: db.pesticides,
          inventoryMovements: view.movements,
          treatments: view.treatments,
          alerts: view.alerts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          registrationRequests: view.registrationRequests.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
          auditLog: view.auditLog.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 500),
          generatedAt: nowIso(),
        };
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json(payload);
    }),
  );

  return router;
}
