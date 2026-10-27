import { describe, expect, it } from 'vitest';
import { appendAudit, actorFromAuth, SYSTEM_ACTOR } from '../../server/services/audit';
import { authFor, makeDatabase, FIXTURE_NOW } from '../fixtures';

describe('audit log service', () => {
  it('records actor, role, target and timestamp for every change', () => {
    const db = makeDatabase();
    const actor = actorFromAuth(authFor(db, 'U-DSA-001'));
    const event = appendAudit(db, actor, 'TEST_ACTION', 'testEntity', 'ENTITY-1', 'A test change.', {
      demo: true,
      count: 1,
    });

    expect(event).toMatchObject({
      actorId: 'U-DSA-001',
      actorName: 'Amine Belhadj',
      role: 'DSA_ADMIN',
      action: 'TEST_ACTION',
      entityType: 'testEntity',
      entityId: 'ENTITY-1',
      summary: 'A test change.',
      metadata: { demo: true, count: 1 },
    });
    expect(Date.parse(event.timestamp)).not.toBeNaN();
    expect(db.auditLog).toContainEqual(event);
  });

  it('uses an explicit system actor for non-user operations', () => {
    const db = makeDatabase();
    appendAudit(db, SYSTEM_ACTOR, 'SYSTEM_ACTION', 'system', 'SYSTEM', 'System test.');
    expect(db.auditLog.at(-1)).toMatchObject({ actorId: 'SYSTEM', role: 'DSA_ADMIN' });
  });

  it('keeps the local log bounded while retaining recent history', () => {
    const db = makeDatabase();
    const actor = { id: 'U-DSA-001', name: 'Amine Belhadj', role: 'DSA_ADMIN' as const };
    for (let index = 0; index < 5002; index += 1) {
      appendAudit(db, actor, 'BULK', 'bulk', `E-${index}`, `Bulk entry ${index}.`);
    }
    expect(db.auditLog).toHaveLength(5000);
    expect(db.auditLog[0]?.entityId).toBe('E-2');
    expect(db.auditLog.at(-1)?.entityId).toBe('E-5001');

    // The audit log is append-only in normal operation, but it is a plain JSON file:
    // anyone with local file access can edit it. This is documented as a caveat.
    expect(FIXTURE_NOW).toBe('2026-03-15T09:00:00.000Z');
  });
});
