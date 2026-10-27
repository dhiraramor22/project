import { describe, expect, it } from 'vitest';
import {
  cropIsInScope,
  farmerIsInScope,
  holdingIsInScope,
  movementIsInScope,
  scopeToAccessScope,
  treatmentIsInScope,
} from '../../src/domain/scope';
import { authFor, makeDatabase, makeTreatment } from '../fixtures';

describe('role and commune scoping', () => {
  const db = makeDatabase();
  const dsa = scopeToAccessScope({ role: 'DSA_ADMIN', userId: 'U-DSA-001' });
  const chamber = scopeToAccessScope({
    role: 'CHAMBER_ADMIN',
    userId: 'U-CHM-001',
    scopeCommunes: ['Guemar'],
  });
  const farmer = scopeToAccessScope({ role: 'FARMER', userId: 'U-FRM-001', farmerId: 'FRM-001' });

  it('lets the DSA administrator see every record', () => {
    expect(db.farmers.every((item) => farmerIsInScope(dsa, item))).toBe(true);
    expect(db.holdings.every((item) => holdingIsInScope(dsa, item))).toBe(true);
  });

  it('scopes the Chamber administrator by commune', () => {
    expect(farmerIsInScope(chamber, db.farmers[0]!)).toBe(true);
    expect(farmerIsInScope(chamber, db.farmers[1]!)).toBe(false);
    expect(holdingIsInScope(chamber, db.holdings[0]!)).toBe(true);
    expect(holdingIsInScope(chamber, db.holdings[1]!)).toBe(false);
    expect(farmerIsInScope({ ...chamber, scopeCommunes: undefined }, db.farmers[1]!)).toBe(true);
  });

  it('scopes a farmer to their own farmer, holding, crop, treatment and movements', () => {
    expect(farmerIsInScope(farmer, db.farmers[0]!)).toBe(true);
    expect(farmerIsInScope(farmer, db.farmers[1]!)).toBe(false);
    expect(holdingIsInScope(farmer, db.holdings[0]!)).toBe(true);
    expect(holdingIsInScope(farmer, db.holdings[1]!)).toBe(false);
    expect(cropIsInScope(farmer, db.crops[0]!, db.holdings)).toBe(true);
    expect(cropIsInScope(farmer, db.crops[1]!, db.holdings)).toBe(false);

    const ownTreatment = makeTreatment();
    const otherTreatment = makeTreatment({ id: 'TRT-OTHER', farmerId: 'FRM-002', holdingId: 'HLD-002' });
    expect(treatmentIsInScope(farmer, ownTreatment, db.holdings)).toBe(true);
    expect(treatmentIsInScope(farmer, otherTreatment, db.holdings)).toBe(false);
    expect(movementIsInScope(farmer, db.inventoryMovements[0]!, db.holdings)).toBe(true);
    expect(movementIsInScope(farmer, db.inventoryMovements[2]!, db.holdings)).toBe(false);
  });

  it('scopes treatments and movements for the Chamber by their holding commune', () => {
    const ownTreatment = makeTreatment();
    expect(treatmentIsInScope(chamber, ownTreatment, db.holdings)).toBe(true);
    expect(
      treatmentIsInScope(
        chamber,
        makeTreatment({ id: 'TRT-H2', holdingId: 'HLD-002', farmerId: 'FRM-002' }),
        db.holdings,
      ),
    ).toBe(false);
    expect(movementIsInScope(chamber, db.inventoryMovements[0]!, db.holdings)).toBe(true);
    expect(movementIsInScope(chamber, db.inventoryMovements[2]!, db.holdings)).toBe(false);
  });

  it('builds the same scope from an authenticated request context', () => {
    const auth = authFor(db, 'U-CHM-001');
    const scope = scopeToAccessScope({
      role: auth.role,
      userId: auth.user.id,
      farmerId: auth.farmerId,
      scopeCommunes: auth.scopeCommunes,
    });
    expect(scope).toEqual({
      role: 'CHAMBER_ADMIN',
      userId: 'U-CHM-001',
      farmerId: undefined,
      scopeCommunes: ['Guemar'],
    });
  });
});
