import { deriveAlertCandidates, mergeAlerts } from '../../src/domain/alerts';
import type { Database } from '../../src/domain/types';
import { nowIso } from '../../src/domain/ids';

export function syncAlerts(db: Database): void {
  const candidates = deriveAlertCandidates({
    settings: db.settings,
    farmers: db.farmers,
    holdings: db.holdings,
    products: db.pesticides,
    movements: db.inventoryMovements,
    treatments: db.treatments,
    registrationRequests: db.registrationRequests,
  });
  db.alerts = mergeAlerts(db.alerts, candidates, nowIso());
}
