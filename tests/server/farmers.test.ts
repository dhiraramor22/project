import { describe, expect, it } from 'vitest';
import {
  approveRegistration,
  createAdminFarmer,
  createSelfRegistration,
  rejectRegistration,
  setFarmerSuspension,
  updateFarmerSelf,
} from '../../server/services/farmers';
import { ApiError } from '../../server/http/errors';
import { actorFor, authFor, makeDatabase, makeRegistrationInput } from '../fixtures';

function expectApiError(fn: () => unknown, code: string, status?: number): ApiError {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ApiError);
  const apiError = caught as ApiError;
  expect(apiError.code).toBe(code);
  if (status !== undefined) expect(apiError.status).toBe(status);
  return apiError;
}

describe('farmer registration and approval', () => {
  it('creates a self-registration as PENDING with no login account and an audit trail', () => {
    const db = makeDatabase();
    const { farmer, request } = createSelfRegistration(
      db,
      makeRegistrationInput({ fullName: 'Nouveau Fellah', email: 'nouveau@demo.eloued.dz' }),
    );

    expect(farmer.status).toBe('PENDING');
    expect(farmer.userId).toBeUndefined();
    expect(farmer.proposedHoldingName).toBe('New Oasis');
    expect(farmer.mainCrops).toEqual(['Tomato', 'Potato']);
    expect(request.status).toBe('PENDING');
    expect(request.source).toBe('SELF');
    expect(db.users.some((user) => user.email === 'nouveau@demo.eloued.dz')).toBe(false);
    expect(db.auditLog.at(-1)).toMatchObject({
      action: 'REGISTRATION_SUBMITTED',
      entityId: request.id,
      role: 'FARMER',
    });
    expect(db.alerts.some((alert) => alert.entityId === request.id)).toBe(true);
  });

  it('rejects duplicate emails and disabled self-registration', () => {
    const db = makeDatabase();
    expectApiError(
      () => createSelfRegistration(db, makeRegistrationInput({ email: 'youcef.benali@demo.eloued.dz' })),
      'EMAIL_IN_USE',
      409,
    );
    db.settings.allowSelfRegistration = false;
    expectApiError(
      () => createSelfRegistration(db, makeRegistrationInput({ email: 'other@demo.eloued.dz' })),
      'SELF_REGISTRATION_DISABLED',
      403,
    );
  });

  it('approves a pending registration, creates an invited account and initial holding', () => {
    const db = makeDatabase();
    const actor = actorFor(db, 'U-DSA-001');
    const approved = approveRegistration(db, actor, 'REG-003', 'Verified documents locally.');

    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('U-DSA-001');
    expect(approved.userId).toBeDefined();
    const user = db.users.find((item) => item.id === approved.userId);
    expect(user).toMatchObject({ role: 'FARMER', status: 'INVITED', farmerId: 'FRM-003' });
    expect(db.registrationRequests.find((item) => item.id === 'REG-003')).toMatchObject({
      status: 'APPROVED',
      reviewedBy: 'U-DSA-001',
      reviewNotes: 'Verified documents locally.',
    });

    const holding = db.holdings.find((item) => item.ownerFarmerId === 'FRM-003');
    expect(holding).toMatchObject({ name: 'Dhaouadi Oasis', commune: 'Guemar', totalCultivatedAreaHa: 1.5 });
    expect(db.plots.some((plot) => plot.holdingId === holding?.id)).toBe(true);
    expect(db.auditLog.at(-1)?.action).toBe('REGISTRATION_APPROVED');
    expect(db.alerts.some((alert) => alert.entityId === 'REG-003' && !alert.resolved)).toBe(false);
  });

  it('refuses to review the same registration twice', () => {
    const db = makeDatabase();
    const actor = actorFor(db, 'U-DSA-001');
    approveRegistration(db, actor, 'REG-003', undefined);
    expectApiError(() => approveRegistration(db, actor, 'REG-003', undefined), 'REGISTRATION_ALREADY_REVIEWED', 409);
    expectApiError(() => rejectRegistration(db, actor, 'REG-003', 'late rejection'), 'REGISTRATION_ALREADY_REVIEWED', 409);
    expectApiError(() => approveRegistration(db, actor, 'UNKNOWN', undefined), 'REGISTRATION_NOT_FOUND', 404);
  });

  it('rejects a pending registration with a reason and no account', () => {
    const db = makeDatabase();
    const actor = actorFor(db, 'U-DSA-001');
    const rejected = rejectRegistration(db, actor, 'REG-003', 'Incomplete file.');
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Incomplete file.');
    expect(db.users.some((item) => item.farmerId === 'FRM-003')).toBe(false);
    expect(db.auditLog.at(-1)).toMatchObject({ action: 'REGISTRATION_REJECTED' });
  });

  it('creates an administrator-provisioned farmer as approved with a simulated invitation', () => {
    const db = makeDatabase();
    const actor = actorFor(db, 'U-DSA-001');
    const { farmer, user, request } = createAdminFarmer(
      db,
      actor,
      makeRegistrationInput({ fullName: 'Admin Created', email: 'admin.created@demo.eloued.dz', commune: 'Robbah' }),
    );
    expect(farmer.status).toBe('APPROVED');
    expect(user).toMatchObject({ role: 'FARMER', status: 'INVITED', farmerId: farmer.id });
    expect(request.source).toBe('ADMIN');
    expect(request.status).toBe('APPROVED');
    expect(db.holdings.some((holding) => holding.ownerFarmerId === farmer.id)).toBe(true);
    expect(db.auditLog.map((event) => event.action)).toContain('FARMER_CREATED_BY_ADMIN');
  });

  it('suspends and reactivates both the farmer profile and the linked account', () => {
    const db = makeDatabase();
    const actor = actorFor(db, 'U-DSA-001');
    setFarmerSuspension(db, actor, 'FRM-002', true);
    expect(db.farmers.find((item) => item.id === 'FRM-002')?.status).toBe('SUSPENDED');
    expect(db.users.find((item) => item.id === 'U-FRM-002')?.status).toBe('SUSPENDED');

    setFarmerSuspension(db, actor, 'FRM-002', false);
    expect(db.farmers.find((item) => item.id === 'FRM-002')?.status).toBe('APPROVED');
    expect(db.users.find((item) => item.id === 'U-FRM-002')?.status).toBe('ACTIVE');

    expectApiError(() => setFarmerSuspension(db, actor, 'FRM-003', true), 'FARMER_NOT_APPROVED', 409);
  });

  it('lets a farmer update only their own profile and keeps the account in sync', () => {
    const db = makeDatabase();
    const auth = authFor(db, 'U-FRM-001');
    const actor = actorFor(db, 'U-FRM-001');
    const updated = updateFarmerSelf(db, auth, actor, {
      fullName: 'Youcef Benali Updated',
      email: 'youcef.updated@demo.eloued.dz',
      phone: '+213 555 03 03 04',
      preferredLanguage: 'ar',
      agriculturalId: 'AG-001-UPDATED',
    });
    expect(updated.email).toBe('youcef.updated@demo.eloued.dz');
    expect(db.users.find((item) => item.id === 'U-FRM-001')).toMatchObject({
      fullName: 'Youcef Benali Updated',
      email: 'youcef.updated@demo.eloued.dz',
      preferredLanguage: 'ar',
    });
    expect(db.auditLog.at(-1)?.action).toBe('FARMER_PROFILE_UPDATED');

    expectApiError(
      () =>
        updateFarmerSelf(db, auth, actor, {
          fullName: 'Imposter',
          email: 'salima.rahmani@demo.eloued.dz',
          phone: '+213 555 03 03 04',
          preferredLanguage: 'en',
        }),
      'EMAIL_IN_USE',
      409,
    );
  });
});
