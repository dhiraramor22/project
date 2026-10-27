import { Router } from 'express';
import { z } from 'zod';
import { REPORT_ALLOWED_ROLES, REPORT_TYPES, type ReportType } from '../../src/domain/api';
import { asyncHandler, parseQuery } from '../http/validation';
import type { JsonStore } from '../repositories/jsonStore';
import { requirePermission } from '../http/auth';
import { appendAudit, actorFromAuth } from '../services/audit';
import { buildScopedView } from '../services/scopedData';
import { generateReport } from '../services/reports';
import { ApiError } from '../http/errors';

const querySchema = z.object({
  seasonId: z.string().trim().optional(),
  cropId: z.string().trim().optional(),
  holdingId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export function reportRoutes(store: JsonStore): Router {
  const router = Router();

  router.get(
    '/reports/:type',
    requirePermission('report:export'),
    asyncHandler(async (req, res) => {
      const reportType = req.params.type as ReportType;
      if (!REPORT_TYPES.includes(reportType)) {
        throw new ApiError(404, 'REPORT_NOT_FOUND', 'Unknown report type.');
      }
      if (!REPORT_ALLOWED_ROLES[reportType].includes(req.auth!.role)) {
        throw new ApiError(403, 'REPORT_FORBIDDEN', 'Your role may not export this report.');
      }
      const filters = parseQuery(querySchema, req.query);
      const report = await store.transaction((db) => {
        const view = buildScopedView(db, req.auth!);
        const result = generateReport(db, view, reportType, filters);
        appendAudit(
          db,
          actorFromAuth(req.auth!),
          'REPORT_GENERATED',
          'report',
          reportType,
          `Report "${reportType}" generated with ${result.rowCount} row(s).`,
          {
            reportType,
            rowCount: result.rowCount,
            filters: JSON.stringify(
              Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value))),
            ),
          },
        );
        return result;
      });
      res.json(report);
    }),
  );

  return router;
}
