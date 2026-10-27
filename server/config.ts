import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..');
export const DATA_DIR = path.resolve(ROOT_DIR, 'data');
export const SEED_DIR = path.resolve(DATA_DIR, 'demo-seed');
export const BACKUP_DIR = path.resolve(DATA_DIR, 'backups');
export const CORRUPT_DIR = path.resolve(DATA_DIR, 'corrupt');
export const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
export const JOURNAL_PATH = path.resolve(DATA_DIR, '.journal.json');

export const HOST = '127.0.0.1';
export const PORT = Number(process.env.PORT ?? 4000);
export const SERVE_STATIC = process.argv.includes('--serve-static');

export const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
];

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}
