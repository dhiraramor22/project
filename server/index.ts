import path from 'node:path';
import fs from 'node:fs';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import {
  ALLOWED_ORIGINS,
  BACKUP_DIR,
  CORRUPT_DIR,
  DATA_DIR,
  DIST_DIR,
  HOST,
  JOURNAL_PATH,
  PORT,
  SEED_DIR,
  SERVE_STATIC,
} from './config';
import { JsonStore } from './repositories/jsonStore';
import { publicRoutes } from './routes/public';
import { bootstrapRoutes } from './routes/bootstrap';
import { farmerRoutes } from './routes/farmers';
import { farmRoutes } from './routes/farm';
import { catalogueRoutes } from './routes/catalogue';
import { inventoryRoutes } from './routes/inventory';
import { treatmentRoutes } from './routes/treatments';
import { tfiRoutes } from './routes/tfi';
import { alertRoutes } from './routes/alerts';
import { reportRoutes } from './routes/reports';
import { settingsRoutes } from './routes/settings';
import { adminRoutes } from './routes/admin';
import { attachAuth, originGuard } from './http/auth';
import { ApiError } from './http/errors';
import { syncAlerts } from './services/alerts';

const store = new JsonStore({
  dataDir: DATA_DIR,
  seedDir: SEED_DIR,
  backupDir: BACKUP_DIR,
  corruptDir: CORRUPT_DIR,
  journalPath: JOURNAL_PATH,
});

async function main(): Promise<void> {
  await store.init();
  await store.transaction((db) => {
    syncAlerts(db);
  });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  });

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'x-user-id', 'x-user-role'],
      maxAge: 600,
    }),
  );
  app.use(originGuard);

  app.use('/api/admin/backup/import', express.json({ limit: '25mb' }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', publicRoutes(store));

  app.use('/api', attachAuth(store));
  app.use('/api', bootstrapRoutes(store));
  app.use('/api', farmerRoutes(store));
  app.use('/api', farmRoutes(store));
  app.use('/api', catalogueRoutes(store));
  app.use('/api', inventoryRoutes(store));
  app.use('/api', treatmentRoutes(store));
  app.use('/api', tfiRoutes(store));
  app.use('/api', alertRoutes(store));
  app.use('/api', reportRoutes(store));
  app.use('/api', settingsRoutes(store));
  app.use('/api', adminRoutes(store));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } });
  });

  if (SERVE_STATIC) {
    if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
      app.use(express.static(DIST_DIR, { index: false }));
      app.get('*', (req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api')) {
          next();
          return;
        }
        res.sendFile(path.join(DIST_DIR, 'index.html'));
      });
    } else {
      console.warn('[server] dist/index.html was not found. Run "npm run build" before "npm start".');
    }
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;

    if (error instanceof ApiError) {
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    const maybeBodyError = error as { type?: string; status?: number; message?: string };
    if (maybeBodyError.type === 'entity.too.large') {
      res.status(413).json({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' },
      });
      return;
    }
    if (error instanceof SyntaxError && maybeBodyError.status === 400) {
      res.status(400).json({
        error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' },
      });
      return;
    }

    console.error('[server] Unhandled request error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The local service could not complete the request. See the server console for details.',
      },
    });
  });

  const server = app.listen(PORT, HOST, () => {
    console.info('');
    console.info('  El Oued Pesticide Management Platform — local prototype');
    console.info(`  Local service: http://${HOST}:${PORT}`);
    console.info(`  Frontend:      ${SERVE_STATIC ? `http://${HOST}:${PORT}` : 'http://127.0.0.1:5173'}`);
    console.info(`  Data dir:      ${DATA_DIR}`);
    console.info('  This service is bound to the loopback interface only. No cloud or database is used.');
    console.info('');
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[server] Failed to start:', error);
  process.exit(1);
});
