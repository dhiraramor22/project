import type { AuditEvent, Database, Role } from '../../src/domain/types';
import { makeId, nowIso } from '../../src/domain/ids';

export interface AuditActor {
  id: string;
  name: string;
  role: Role;
}

export const SYSTEM_ACTOR: AuditActor = {
  id: 'SYSTEM',
  name: 'Local system',
  role: 'DSA_ADMIN',
};

export function appendAudit(
  db: Database,
  actor: AuditActor,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  metadata?: AuditEvent['metadata'],
): AuditEvent {
  const event: AuditEvent = {
    id: makeId('AUD'),
    actorId: actor.id,
    actorName: actor.name,
    role: actor.role,
    action,
    entityType,
    entityId,
    summary,
    metadata,
    timestamp: nowIso(),
  };
  db.auditLog.push(event);
  // Keep the local log bounded while retaining recent history.
  if (db.auditLog.length > 5000) {
    db.auditLog.splice(0, db.auditLog.length - 5000);
  }
  return event;
}

export function actorFromAuth(auth: { user: { id: string; fullName: string }; role: Role }): AuditActor {
  return { id: auth.user.id, name: auth.user.fullName, role: auth.role };
}
