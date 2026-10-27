import fs from 'node:fs/promises';
import path from 'node:path';
import type { Database } from '../../src/domain/types';
import {
  ARRAY_KEYS,
  COLLECTION_FILES,
  FILE_KEYS,
  createEmptyDatabase,
  isValidCollectionShape,
  type FileKey,
} from './fileMap';

interface JournalEntry {
  previous: string | null;
  next: string;
}

interface Journal {
  startedAt: string;
  files: Partial<Record<FileKey, JournalEntry>>;
}

export interface JsonStoreOptions {
  dataDir: string;
  seedDir: string;
  backupDir: string;
  corruptDir: string;
  journalPath: string;
  logger?: Pick<Console, 'warn' | 'info' | 'error'>;
}

export interface BackupSummary {
  fileName: string;
  filePath: string;
  createdAt: string;
  bytes: number;
}

function timestampForFile(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random()
    .toString(36)
    .slice(2, 7)}.tmp`;
  await fs.writeFile(tempPath, content, { encoding: 'utf8' });
  await fs.rename(tempPath, filePath);
}

/**
 * A local, single-process JSON persistence adapter.
 *
 * - All mutating operations are serialized through one queue.
 * - A transaction works on a draft and only becomes visible after every file is written.
 * - A journal stores pre-images. If a write fails (or the process crashes mid-commit),
 *   the next startup restores the pre-images and discards the partial commit.
 *
 * This is a local development adapter, not a production database.
 */
export class JsonStore {
  private data: Database = createEmptyDatabase();
  private queue: Promise<void> = Promise.resolve();
  private readonly logger: Pick<Console, 'warn' | 'info' | 'error'>;
  private initialized = false;

  constructor(private readonly options: JsonStoreOptions) {
    this.logger = options.logger ?? console;
  }

  get dataDirectory(): string {
    return this.options.dataDir;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.options.dataDir, { recursive: true });
    await fs.mkdir(this.options.backupDir, { recursive: true });
    await fs.mkdir(this.options.corruptDir, { recursive: true });
    await this.recoverJournal();

    const seed = await this.loadSeedOrEmpty();
    const data = createEmptyDatabase();
    let created = 0;

    for (const key of FILE_KEYS) {
      const filePath = this.filePath(key);
      const seedValue = seed[key];

      if (!(await pathExists(filePath))) {
        const initial = seedValue ?? data[key];
        await atomicWrite(filePath, this.serialize(initial));
        (data as unknown as Record<string, unknown>)[key] = initial;
        created += 1;
        continue;
      }

      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed: unknown = JSON.parse(raw);
        if (!isValidCollectionShape(key, parsed)) {
          throw new Error(`Invalid top-level shape for ${COLLECTION_FILES[key]}`);
        }
        (data as unknown as Record<string, unknown>)[key] = parsed;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `[data] ${COLLECTION_FILES[key]} is invalid (${message}). Moving it to corrupt/ and restoring demo defaults.`,
        );
        await this.quarantine(key);
        const fallback = seedValue ?? data[key];
        await atomicWrite(filePath, this.serialize(fallback));
        (data as unknown as Record<string, unknown>)[key] = fallback;
      }
    }

    // Basic referential cleanup guard: duplicate IDs are never silently accepted.
    for (const key of ARRAY_KEYS) {
      const rows = data[key] as Array<{ id?: string }>;
      const ids = new Set<string>();
      for (const row of rows) {
        if (row?.id) ids.add(row.id);
      }
      if (ids.size !== rows.length) {
        this.logger.warn(`[data] ${COLLECTION_FILES[key]} contains duplicate or missing IDs.`);
      }
    }

    this.data = data;
    this.initialized = true;
    if (created > 0) {
      this.logger.info(`[data] Initialized ${created} JSON file(s) in ${this.options.dataDir}`);
    }
  }

  async read<T>(reader: (data: Database) => T): Promise<T> {
    this.assertInitialized();
    await this.queue;
    return reader(structuredClone(this.data));
  }

  async snapshot(): Promise<Database> {
    this.assertInitialized();
    await this.queue;
    return structuredClone(this.data);
  }

  async transaction<T>(mutator: (data: Database) => T | Promise<T>): Promise<T> {
    this.assertInitialized();
    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      const draft = structuredClone(this.data);
      const result = await mutator(draft);
      await this.persist(draft);
      this.data = draft;
      return result;
    } finally {
      release();
    }
  }

  async replaceAll(next: Database): Promise<void> {
    await this.transaction(async (draft) => {
      for (const key of FILE_KEYS) {
        (draft as unknown as Record<string, unknown>)[key] = structuredClone(
          (next as unknown as Record<string, unknown>)[key],
        );
      }
    });
  }

  async backup(prefix = 'backup'): Promise<BackupSummary> {
    const snapshot = await this.snapshot();
    const createdAt = new Date().toISOString();
    const fileName = `${prefix}-${timestampForFile()}.json`;
    const filePath = path.join(this.options.backupDir, fileName);
    const payload = {
      format: 'el-oued-json-backup',
      formatVersion: 1,
      exportedAt: createdAt,
      source: 'local-prototype',
      data: snapshot,
    };
    const content = this.serialize(payload);
    await atomicWrite(filePath, content);
    return {
      fileName,
      filePath,
      createdAt,
      bytes: Buffer.byteLength(content, 'utf8'),
    };
  }

  async listBackups(): Promise<BackupSummary[]> {
    await fs.mkdir(this.options.backupDir, { recursive: true });
    const entries = await fs.readdir(this.options.backupDir, { withFileTypes: true });
    const backups: BackupSummary[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const filePath = path.join(this.options.backupDir, entry.name);
      const stat = await fs.stat(filePath);
      backups.push({
        fileName: entry.name,
        filePath,
        createdAt: stat.mtime.toISOString(),
        bytes: stat.size,
      });
    }
    return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async loadSeed(): Promise<Database> {
    return this.loadSeedOrEmpty();
  }

  private assertInitialized(): void {
    if (!this.initialized) throw new Error('JsonStore has not been initialized.');
  }

  private filePath(key: FileKey): string {
    return path.join(this.options.dataDir, COLLECTION_FILES[key]);
  }

  private serialize(value: unknown): string {
    return `${JSON.stringify(value, null, 2)}\n`;
  }

  private async loadSeedOrEmpty(): Promise<Database> {
    const seed = createEmptyDatabase();
    for (const key of FILE_KEYS) {
      const seedPath = path.join(this.options.seedDir, COLLECTION_FILES[key]);
      if (!(await pathExists(seedPath))) continue;
      try {
        const raw = await fs.readFile(seedPath, 'utf8');
        const parsed: unknown = JSON.parse(raw);
        if (!isValidCollectionShape(key, parsed)) {
          this.logger.warn(`[data] Seed ${COLLECTION_FILES[key]} has an invalid shape. Using defaults.`);
          continue;
        }
        (seed as unknown as Record<string, unknown>)[key] = parsed;
      } catch (error) {
        this.logger.warn(
          `[data] Could not read seed ${COLLECTION_FILES[key]}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return seed;
  }

  private async quarantine(key: FileKey): Promise<void> {
    const target = path.join(
      this.options.corruptDir,
      `corrupt-${timestampForFile()}-${COLLECTION_FILES[key]}`,
    );
    try {
      await fs.rename(this.filePath(key), target);
    } catch (error) {
      this.logger.warn(
        `[data] Could not quarantine ${COLLECTION_FILES[key]}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async persist(next: Database): Promise<void> {
    const changes: Partial<Record<FileKey, { previous: string | null; next: string }>> = {};

    for (const key of FILE_KEYS) {
      const filePath = this.filePath(key);
      const nextContent = this.serialize((next as unknown as Record<string, unknown>)[key]);
      let previousContent: string | null = null;
      try {
        previousContent = await fs.readFile(filePath, 'utf8');
      } catch {
        previousContent = null;
      }
      if (previousContent !== nextContent) {
        changes[key] = { previous: previousContent, next: nextContent };
      }
    }

    const changedKeys = Object.keys(changes) as FileKey[];
    if (changedKeys.length === 0) return;

    const journal: Journal = { startedAt: new Date().toISOString(), files: changes };
    await atomicWrite(this.options.journalPath, this.serialize(journal));

    try {
      for (const key of changedKeys) {
        await atomicWrite(this.filePath(key), changes[key]!.next);
      }
      await fs.rm(this.options.journalPath, { force: true });
    } catch (error) {
      this.logger.error('[data] Commit failed. Attempting rollback from journal pre-images.');
      try {
        await this.restoreJournalFiles(journal);
        await fs.rm(this.options.journalPath, { force: true });
      } catch (rollbackError) {
        this.logger.error(
          `[data] Rollback failed. The journal will be replayed at next startup: ${
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          }`,
        );
      }
      throw error;
    }
  }

  private async restoreJournalFiles(journal: Journal): Promise<void> {
    for (const [key, entry] of Object.entries(journal.files) as Array<[FileKey, JournalEntry]>) {
      const filePath = this.filePath(key);
      if (entry.previous === null) {
        await fs.rm(filePath, { force: true });
      } else {
        await atomicWrite(filePath, entry.previous);
      }
    }
  }

  private async recoverJournal(): Promise<void> {
    if (!(await pathExists(this.options.journalPath))) return;
    try {
      const raw = await fs.readFile(this.options.journalPath, 'utf8');
      const journal = JSON.parse(raw) as Journal;
      this.logger.warn('[data] Found an interrupted transaction. Restoring previous file versions.');
      await this.restoreJournalFiles(journal);
      await fs.rm(this.options.journalPath, { force: true });
    } catch (error) {
      this.logger.error(
        `[data] Could not recover interrupted transaction journal: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
