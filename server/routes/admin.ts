import { Router } from 'express';
import { z } from 'zod';
import { nowIso } from '../../src/domain/ids';
import { asyncHandler, parseBody } from '../http/validation';
import type { JsonStore } from '../repositories/jsonStore';
import { requirePermission } from '../http/auth';
import { appendAudit, actorFromAuth, SYSTEM_ACTOR } from '../services/audit';
import { validateBackupPayload } from '../validation/backup';
import { ApiError } from '../http/errors';

const importSchema = z.object({
  confirm: z.literal('IMPORT_BACKUP', {
    errorMap: () => ({ message: 'Type IMPORT_BACKUP to confirm replacing local records.' }),
  }),
  backup: z.unknown(),
});

const resetSchema = z.object({
  confirm: z.literal('RESET_DEMO', {
    errorMap: () => ({ message: 'Type RESET_DEMO to confirm the demonstration data reset.' }),
  }),
});

export function adminRoutes(store: JsonStore): Router {
  const router = Router();

  router.get(
    '/admin/backup',
    requirePermission('backup:manage'),
    asyncHandler(async (req, res) => {
      const snapshot = await store.snapshot();
      const exportedAt = nowIso();
      const payload = {
        format: 'el-oued-json-backup',
        formatVersion: 1,
        exportedAt,
        source: 'local-prototype',
        data: snapshot,
      };
      await store.transaction((db) => {
        appendAudit(
          db,
          actorFromAuth(req.auth!),
          'BACKUP_EXPORTED',
          'backup',
          exportedAt,
          'Full JSON backup exported by the administrator.',
          { exportedAt },
        );
      });
      const fileName = `el-oued-backup-${exportedAt.replace(/[:.]/g, '-')}.json`;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(`${JSON.stringify(payload, null, 2)}\n`);
    }),
  );

  router.get(
    '/admin/backups',
    requirePermission('backup:manage'),
    asyncHandler(async (_req, res) => {
      const backups = await store.listBackups();
      res.json({
        backups: backups.map((backup) => ({
          fileName: backup.fileName,
          createdAt: backup.createdAt,
          bytes: backup.bytes,
        })),
      });
    }),
  );

  router.post(
    '/admin/backup/import',
    requirePermission('backup:manage'),
    asyncHandler(async (req, res) => {
      const body = parseBody(importSchema, req.body);
      const validation = validateBackupPayload(body.backup);
      if (!validation.ok || !validation.data) {
        throw new ApiError(422, 'INVALID_BACKUP', 'The backup file failed validation.', {
          issues: validation.errors.map((message) => ({ path: 'backup', message })),
        });
      }
      const preImport = await store.backup('pre-import');
      await store.replaceAll(validation.data);
      await store.transaction((db) => {
        const actorExists = db.users.some((user) => user.id === req.auth!.user.id);
        appendAudit(
          db,
          actorExists ? actorFromAuth(req.auth!) : SYSTEM_ACTOR,
          'BACKUP_IMPORTED',
          'backup',
          preImport.fileName,
          'Full JSON backup imported. The previous local data set was saved before replacement.',
          {
            preImportBackup: preImport.fileName,
            importedExportedAt: validation.exportedAt ?? '',
          },
        );
      });
      res.json({
        imported: true,
        preImportBackup: preImport.fileName,
        message: 'Backup imported. The previous data set was saved in the local backups directory.',
      });
    }),
  );

  router.post(
    '/admin/reset-demo',
    requirePermission('backup:manage'),
    asyncHandler(async (req, res) => {
      parseBody(resetSchema, req.body ?? {});
      const preReset = await store.backup('pre-reset');
      const seed = await store.loadSeed();
      if (seed.users.length === 0) {
        throw new ApiError(500, 'SEED_DATA_MISSING', 'Demo seed data is unavailable; nothing was reset.');
      }
      seed.settings.lastResetAt = nowIso();
      seed.settings.updatedAt = nowIso();
      await store.replaceAll(seed);
      await store.transaction((db) => {
        const actorExists = db.users.some((user) => user.id === req.auth!.user.id);
        appendAudit(
          db,
          actorExists ? actorFromAuth(req.auth!) : SYSTEM_ACTOR,
          'DEMO_DATA_RESET',
          'backup',
          preReset.fileName,
          'Demonstration data was reset. Previous local data was backed up first.',
          { preResetBackup: preReset.fileName },
        );
      });
      res.json({
        reset: true,
        preResetBackup: preReset.fileName,
        message: 'Demonstration data restored from the local seed. Previous data was backed up.',
      });
    }),
  );

  return router;
}
