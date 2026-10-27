import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonStore, type JsonStoreOptions } from '../../server/repositories/jsonStore';
import { COLLECTION_FILES, FILE_KEYS } from '../../server/repositories/fileMap';
import { validateBackupPayload } from '../../server/validation/backup';
import { makeDatabase } from '../fixtures';

let root: string;
let options: JsonStoreOptions;
let logger: Required<Pick<Console, 'warn' | 'info' | 'error'>>;
const silentLogger = () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() });

async function writeSeed(seedDir: string): Promise<void> {
  const db = makeDatabase();
  await fs.mkdir(seedDir, { recursive: true });
  for (const key of FILE_KEYS) {
    await fs.writeFile(
      path.join(seedDir, COLLECTION_FILES[key]),
      `${JSON.stringify((db as unknown as Record<string, unknown>)[key], null, 2)}\n`,
      'utf8',
    );
  }
}

describe('JSON persistence adapter', () => {
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'eloued-store-'));
    logger = silentLogger();
    options = {
      dataDir: path.join(root, 'data'),
      seedDir: path.join(root, 'seed'),
      backupDir: path.join(root, 'backups'),
      corruptDir: path.join(root, 'corrupt'),
      journalPath: path.join(root, 'data', '.journal.json'),
      logger,
    };
    await writeSeed(options.seedDir);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('initializes every collection file from the seed on first start', async () => {
    const store = new JsonStore(options);
    await store.init();

    const files = await fs.readdir(options.dataDir);
    for (const fileName of Object.values(COLLECTION_FILES)) {
      expect(files).toContain(fileName);
    }

    const snapshot = await store.snapshot();
    expect(snapshot.users).toHaveLength(4);
    expect(snapshot.farmers).toHaveLength(3);
    expect(snapshot.pesticides).toHaveLength(3);
    expect(snapshot.settings.applicationName).toBe('El Oued Pesticide Management Platform');
    expect(logger.info).toHaveBeenCalled();
  });

  it('persists a committed transaction and reloads it after a simulated restart', async () => {
    const first = new JsonStore(options);
    await first.init();

    await first.transaction((db) => {
      db.farmers.push({
        ...db.farmers[0]!,
        id: 'FRM-RESTART',
        fullName: 'Restart Farmer',
        email: 'restart@demo.eloued.dz',
      });
      db.settings.applicationName = 'Changed Locally';
    });

    const second = new JsonStore(options);
    await second.init();
    const snapshot = await second.snapshot();
    expect(snapshot.farmers.some((farmer) => farmer.id === 'FRM-RESTART')).toBe(true);
    expect(snapshot.settings.applicationName).toBe('Changed Locally');

    const raw = await fs.readFile(path.join(options.dataDir, 'farmers.json'), 'utf8');
    expect(raw).toContain('FRM-RESTART');
  });

  it('quarantines an invalid file and restores it from the seed instead of losing the rest', async () => {
    const first = new JsonStore(options);
    await first.init();
    const original = await fs.readFile(path.join(options.dataDir, 'farmers.json'), 'utf8');
    await fs.writeFile(path.join(options.dataDir, 'farmers.json'), '{ this is not valid json', 'utf8');

    const second = new JsonStore({ ...options, logger });
    await second.init();
    const snapshot = await second.snapshot();

    expect(snapshot.farmers).toHaveLength(3);
    expect(snapshot.users).toHaveLength(4);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('farmers.json is invalid'));
    const quarantined = await fs.readdir(options.corruptDir);
    expect(quarantined.some((name) => name.includes('farmers.json'))).toBe(true);
    const repaired = await fs.readFile(path.join(options.dataDir, 'farmers.json'), 'utf8');
    expect(JSON.parse(repaired)).toEqual(JSON.parse(original));
  });

  it('restores pre-images from an interrupted transaction journal on startup', async () => {
    const first = new JsonStore(options);
    await first.init();
    const original = await fs.readFile(path.join(options.dataDir, 'farmers.json'), 'utf8');

    await fs.writeFile(
      options.journalPath,
      JSON.stringify({
        startedAt: '2026-03-15T09:00:00.000Z',
        files: {
          farmers: {
            previous: original,
            next: '[{"id":"PARTIAL-WRITE"}]',
          },
        },
      }),
      'utf8',
    );
    await fs.writeFile(path.join(options.dataDir, 'farmers.json'), '[{"id":"PARTIAL-WRITE"}]', 'utf8');

    const second = new JsonStore({ ...options, logger });
    await second.init();
    const snapshot = await second.snapshot();
    expect(snapshot.farmers.map((farmer) => farmer.id)).not.toContain('PARTIAL-WRITE');
    expect(snapshot.farmers).toHaveLength(3);
    await expect(fs.access(options.journalPath)).rejects.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('interrupted transaction'));
  });

  it('exports a validated backup and restores it over newer local changes', async () => {
    const store = new JsonStore(options);
    await store.init();
    const backup = await store.backup('pre-import');
    expect(backup.fileName.startsWith('pre-import-')).toBe(true);
    expect(backup.bytes).toBeGreaterThan(0);

    const payload = JSON.parse(await fs.readFile(backup.filePath, 'utf8')) as unknown;
    const validation = validateBackupPayload(payload);
    expect(validation.ok).toBe(true);
    expect(validation.data?.farmers).toHaveLength(3);

    await store.transaction((db) => {
      db.settings.applicationName = 'Newer Local Change';
      db.farmers = db.farmers.slice(0, 1);
    });
    expect((await store.snapshot()).farmers).toHaveLength(1);

    await store.replaceAll(validation.data!);
    const restored = await store.snapshot();
    expect(restored.farmers).toHaveLength(3);
    expect(restored.settings.applicationName).toBe('El Oued Pesticide Management Platform');

    const listed = await store.listBackups();
    expect(listed.map((item) => item.fileName)).toContain(backup.fileName);
  });

  it('refuses to read before initialization', async () => {
    const store = new JsonStore(options);
    await expect(store.snapshot()).rejects.toThrow('not been initialized');
  });
});
