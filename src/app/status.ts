import type { BadgeTone } from '../components/ui/primitives';
import type { Alert } from '../domain/types';

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'APPROVED':
    case 'ACTIVE':
    case 'OK':
    case 'VERIFIED':
      return 'green';
    case 'PENDING':
    case 'INVITED':
    case 'INCOMPLETE':
      return 'amber';
    case 'REJECTED':
    case 'SUSPENDED':
    case 'REVERSED':
      return 'red';
    case 'CLOSED':
    case 'ARCHIVED':
      return 'slate';
    case 'DEMO':
      return 'clay';
    default:
      return 'slate';
  }
}

export function severityTone(severity: string): BadgeTone {
  switch (severity) {
    case 'CRITICAL':
      return 'red';
    case 'WARNING':
      return 'amber';
    default:
      return 'sky';
  }
}

export function verificationTone(status: string): BadgeTone {
  switch (status) {
    case 'VERIFIED':
      return 'green';
    case 'UNVERIFIED':
      return 'amber';
    default:
      return 'clay';
  }
}

export function roleTone(role: string): BadgeTone {
  switch (role) {
    case 'DSA_ADMIN':
      return 'green';
    case 'CHAMBER_ADMIN':
      return 'sky';
    default:
      return 'clay';
  }
}

export function alertTitle(
  t: (key: string, vars?: Record<string, string | number>) => string,
  alert: Alert,
): string {
  return t(alert.titleKey, alert.data);
}

export function alertDescription(
  t: (key: string, vars?: Record<string, string | number>) => string,
  alert: Alert,
): string {
  const descriptionKey = alert.titleKey.replace(/\.title$/, '.description');
  return t(descriptionKey, alert.data);
}

export function alertEntityLink(alert: Alert): string | null {
  switch (alert.entityType) {
    case 'registration':
      return '/registrations';
    case 'treatment':
      return `/treatments/${alert.entityId}`;
    case 'inventory':
      return '/inventory';
    case 'movement':
      return '/inventory';
    case 'holding':
      return `/holdings/${alert.entityId}`;
    default:
      return null;
  }
}
