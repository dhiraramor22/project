import { describe, expect, it } from 'vitest';
import { validateBackupPayload } from '../../server/validation/backup';
import { makeDatabase, FIXTURE_NOW } from '../fixtures';

function envelope(data = makeDatabase()) {
  return {
    format: 'el-oued-json-backup',
    formatVersion: 1,
    exportedAt: FIXTURE_NOW,
    source: 'local-prototype',
    data,
  };
}

describe('backup payload validation', () => {
  it('accepts a complete, internally consistent backup', () => {
    const result = validateBackupPayload(envelope());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data?.farmers).toHaveLength(3);
    expect(result.exportedAt).toBe(FIXTURE_NOW);
  });

  it('rejects an unrelated JSON document', () => {
    const result = validateBackupPayload({ hello: 'world' });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.data).toBeUndefined();
  });

  it('rejects duplicate IDs before import', () => {
    const db = makeDatabase();
    db.farmers.push({ ...db.farmers[0]! });
    const result = validateBackupPayload(envelope(db));
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('farmers.json: duplicate IDs (FRM-001)');
  });

  it('rejects dangling references instead of importing orphan records', () => {
    const db = makeDatabase();
    db.holdings[0]!.ownerFarmerId = 'FRM-NOT-THERE';
    db.crops[0]!.plotId = 'PLT-NOT-THERE';
    const result = validateBackupPayload(envelope(db));
    expect(result.ok).toBe(false);
    const errors = result.errors.join('\n');
    expect(errors).toContain('references unknown farmer FRM-NOT-THERE');
    expect(errors).toContain('Crop CRP-001: unknown plot');
  });

  it('refuses a backup that would lock everyone out of the application', () => {
    const db = makeDatabase();
    db.users = db.users.map((user) => (user.role === 'DSA_ADMIN' ? { ...user, status: 'SUSPENDED' } : user));
    const result = validateBackupPayload(envelope(db));
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('at least one active DSA administrator');
  });

  it('rejects a backup with a missing collection', () => {
    const db = makeDatabase() as unknown as Record<string, unknown>;
    delete db.crops;
    const result = validateBackupPayload(envelope(db as unknown as ReturnType<typeof makeDatabase>));
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('data.crops: Required');
  });
});
