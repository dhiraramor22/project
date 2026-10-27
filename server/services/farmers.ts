import { makeId, nowIso } from '../../src/domain/ids';
import type {
  AgriculturalHolding,
  AuthContext,
  Database,
  FarmerProfile,
  Plot,
  RegistrationRequest,
  User,
} from '../../src/domain/types';
import type { RegistrationInput } from '../../src/domain/schemas';
import { ApiError } from '../http/errors';
import { appendAudit, type AuditActor } from './audit';
import { syncAlerts } from './alerts';

const PUBLIC_ACTOR: AuditActor = {
  id: 'PUBLIC',
  name: 'Public registration form',
  role: 'FARMER',
};

function splitCrops(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function assertEmailAvailable(db: Database, email: string, exceptFarmerId?: string): void {
  const normalized = email.trim().toLowerCase();
  const farmerExists = db.farmers.some(
    (farmer) =>
      farmer.id !== exceptFarmerId &&
      farmer.status !== 'REJECTED' &&
      farmer.email.trim().toLowerCase() === normalized,
  );
  const userExists = db.users.some(
    (user) => user.email.trim().toLowerCase() === normalized,
  );
  if (farmerExists || userExists) {
    throw new ApiError(409, 'EMAIL_IN_USE', 'A farmer or account with this email address already exists.');
  }
}

function createInitialHolding(
  db: Database,
  farmer: FarmerProfile,
  actor: AuditActor,
): { holding: AgriculturalHolding; plot?: Plot } | null {
  if (!farmer.proposedHoldingName || !farmer.proposedAreaHa) return null;
  if (db.holdings.some((holding) => holding.ownerFarmerId === farmer.id)) return null;
  const now = nowIso();
  const holding: AgriculturalHolding = {
    id: makeId('HLD'),
    name: farmer.proposedHoldingName,
    ownerFarmerId: farmer.id,
    wilaya: db.settings.wilaya,
    commune: farmer.commune,
    totalCultivatedAreaHa: farmer.proposedAreaHa,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  db.holdings.push(holding);

  const plot: Plot = {
    id: makeId('PLT'),
    holdingId: holding.id,
    name: 'Main plot',
    areaHa: farmer.proposedAreaHa,
    createdAt: now,
    updatedAt: now,
  };
  db.plots.push(plot);

  appendAudit(
    db,
    actor,
    'HOLDING_CREATED_ON_APPROVAL',
    'holding',
    holding.id,
    `Initial holding "${holding.name}" created from the registration details of ${farmer.fullName}.`,
    { farmerId: farmer.id, areaHa: holding.totalCultivatedAreaHa, demo: db.settings.demoMode },
  );
  return { holding, plot };
}

function createFarmerUser(
  db: Database,
  farmer: FarmerProfile,
  status: User['status'] = 'INVITED',
): User {
  const existing = db.users.find((user) => user.email.toLowerCase() === farmer.email.toLowerCase());
  if (existing) {
    throw new ApiError(409, 'EMAIL_IN_USE', 'An account with this email address already exists.');
  }
  const now = nowIso();
  const user: User = {
    id: makeId('USR'),
    role: 'FARMER',
    fullName: farmer.fullName,
    email: farmer.email,
    phone: farmer.phone,
    preferredLanguage: farmer.preferredLanguage,
    farmerId: farmer.id,
    status,
    demo: false,
    createdAt: now,
    updatedAt: now,
  };
  db.users.push(user);
  farmer.userId = user.id;
  return user;
}

export function createSelfRegistration(
  db: Database,
  input: RegistrationInput,
): { farmer: FarmerProfile; request: RegistrationRequest } {
  if (!db.settings.allowSelfRegistration) {
    throw new ApiError(403, 'SELF_REGISTRATION_DISABLED', 'Self-registration is currently disabled.');
  }
  assertEmailAvailable(db, input.email);
  const now = nowIso();
  const farmer: FarmerProfile = {
    id: makeId('FRM'),
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    preferredLanguage: input.preferredLanguage,
    commune: input.commune,
    agriculturalId: input.agriculturalId || undefined,
    supportingInfo: input.supportingInfo || undefined,
    proposedHoldingName: input.holdingName,
    proposedAreaHa: input.cultivatedAreaHa,
    mainCrops: splitCrops(input.mainCrops),
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };
  const request: RegistrationRequest = {
    id: makeId('REG'),
    farmerId: farmer.id,
    submittedAt: now,
    status: 'PENDING',
    source: 'SELF',
  };
  db.farmers.push(farmer);
  db.registrationRequests.push(request);
  appendAudit(
    db,
    PUBLIC_ACTOR,
    'REGISTRATION_SUBMITTED',
    'registrationRequest',
    request.id,
    `Self-registration submitted for ${farmer.fullName} in ${farmer.commune}.`,
    { farmerId: farmer.id, source: 'SELF' },
  );
  syncAlerts(db);
  return { farmer, request };
}

export function createAdminFarmer(
  db: Database,
  actor: AuditActor,
  input: RegistrationInput,
): { farmer: FarmerProfile; request: RegistrationRequest; user: User } {
  assertEmailAvailable(db, input.email);
  const now = nowIso();
  const farmer: FarmerProfile = {
    id: makeId('FRM'),
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    preferredLanguage: input.preferredLanguage,
    commune: input.commune,
    agriculturalId: input.agriculturalId || undefined,
    supportingInfo: input.supportingInfo || undefined,
    proposedHoldingName: input.holdingName,
    proposedAreaHa: input.cultivatedAreaHa,
    mainCrops: splitCrops(input.mainCrops),
    status: 'APPROVED',
    createdAt: now,
    updatedAt: now,
    approvedAt: now,
    approvedBy: actor.id,
    notes: 'Created by an administrator. Invitation is simulated locally; no email is sent.',
  };
  db.farmers.push(farmer);
  const user = createFarmerUser(db, farmer, 'INVITED');
  createInitialHolding(db, farmer, actor);
  const request: RegistrationRequest = {
    id: makeId('REG'),
    farmerId: farmer.id,
    submittedAt: now,
    status: 'APPROVED',
    source: 'ADMIN',
    reviewedAt: now,
    reviewedBy: actor.id,
    reviewNotes: 'Administrator-created farmer account. Invitation simulation only.',
  };
  db.registrationRequests.push(request);
  appendAudit(
    db,
    actor,
    'FARMER_CREATED_BY_ADMIN',
    'farmer',
    farmer.id,
    `Administrator created farmer ${farmer.fullName} and simulated an invitation.`,
    { farmerId: farmer.id, userId: user.id },
  );
  syncAlerts(db);
  return { farmer, request, user };
}

export function approveRegistration(
  db: Database,
  actor: AuditActor,
  requestId: string,
  notes: string | undefined,
): FarmerProfile {
  const request = db.registrationRequests.find((item) => item.id === requestId);
  if (!request) throw new ApiError(404, 'REGISTRATION_NOT_FOUND', 'Registration request was not found.');
  if (request.status !== 'PENDING') {
    throw new ApiError(409, 'REGISTRATION_ALREADY_REVIEWED', 'This registration request has already been reviewed.');
  }
  const farmer = db.farmers.find((item) => item.id === request.farmerId);
  if (!farmer) throw new ApiError(404, 'FARMER_NOT_FOUND', 'Farmer was not found.');
  if (farmer.status !== 'PENDING') {
    throw new ApiError(409, 'FARMER_NOT_PENDING', 'Only a pending farmer can be approved.');
  }
  assertEmailAvailable(db, farmer.email, farmer.id);
  const now = nowIso();
  request.status = 'APPROVED';
  request.reviewedAt = now;
  request.reviewedBy = actor.id;
  request.reviewNotes = notes || undefined;
  farmer.status = 'APPROVED';
  farmer.approvedAt = now;
  farmer.approvedBy = actor.id;
  farmer.updatedAt = now;
  if (!farmer.userId) {
    createFarmerUser(db, farmer, 'INVITED');
  }
  const holdingResult = createInitialHolding(db, farmer, actor);

  appendAudit(
    db,
    actor,
    'REGISTRATION_APPROVED',
    'registrationRequest',
    request.id,
    `Registration approved for ${farmer.fullName}.`,
    {
      farmerId: farmer.id,
      holdingId: holdingResult?.holding.id ?? '',
      invitationSimulated: true,
    },
  );
  syncAlerts(db);
  return farmer;
}

export function rejectRegistration(
  db: Database,
  actor: AuditActor,
  requestId: string,
  notes: string | undefined,
): FarmerProfile {
  const request = db.registrationRequests.find((item) => item.id === requestId);
  if (!request) throw new ApiError(404, 'REGISTRATION_NOT_FOUND', 'Registration request was not found.');
  if (request.status !== 'PENDING') {
    throw new ApiError(409, 'REGISTRATION_ALREADY_REVIEWED', 'This registration request has already been reviewed.');
  }
  const farmer = db.farmers.find((item) => item.id === request.farmerId);
  if (!farmer) throw new ApiError(404, 'FARMER_NOT_FOUND', 'Farmer was not found.');
  const now = nowIso();
  request.status = 'REJECTED';
  request.reviewedAt = now;
  request.reviewedBy = actor.id;
  request.reviewNotes = notes || undefined;
  farmer.status = 'REJECTED';
  farmer.rejectionReason = notes || undefined;
  farmer.updatedAt = now;
  appendAudit(
    db,
    actor,
    'REGISTRATION_REJECTED',
    'registrationRequest',
    request.id,
    `Registration rejected for ${farmer.fullName}.${notes ? ` Reason: ${notes}` : ''}`,
    { farmerId: farmer.id },
  );
  syncAlerts(db);
  return farmer;
}

export function setFarmerSuspension(
  db: Database,
  actor: AuditActor,
  farmerId: string,
  suspended: boolean,
): FarmerProfile {
  const farmer = db.farmers.find((item) => item.id === farmerId);
  if (!farmer) throw new ApiError(404, 'FARMER_NOT_FOUND', 'Farmer was not found.');
  if (farmer.status === 'PENDING') {
    throw new ApiError(409, 'FARMER_NOT_APPROVED', 'A pending farmer cannot be suspended. Review the registration first.');
  }
  const now = nowIso();
  farmer.status = suspended ? 'SUSPENDED' : 'APPROVED';
  farmer.suspendedAt = suspended ? now : undefined;
  farmer.updatedAt = now;
  for (const user of db.users) {
    if (user.farmerId === farmer.id) {
      user.status = suspended ? 'SUSPENDED' : 'ACTIVE';
      user.updatedAt = now;
    }
  }
  appendAudit(
    db,
    actor,
    suspended ? 'FARMER_SUSPENDED' : 'FARMER_REACTIVATED',
    'farmer',
    farmer.id,
    `${farmer.fullName} was ${suspended ? 'suspended' : 'reactivated'}.`,
    { farmerId: farmer.id },
  );
  syncAlerts(db);
  return farmer;
}

export function updateFarmerSelf(
  db: Database,
  auth: AuthContext,
  actor: AuditActor,
  input: {
    fullName: string;
    email: string;
    phone: string;
    preferredLanguage: FarmerProfile['preferredLanguage'];
    agriculturalId?: string;
    supportingInfo?: string;
  },
): FarmerProfile {
  const farmer = db.farmers.find((item) => item.id === auth.farmerId);
  if (!farmer) throw new ApiError(404, 'FARMER_NOT_FOUND', 'Farmer profile was not found.');
  assertEmailAvailable(db, input.email, farmer.id);
  Object.assign(farmer, {
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    preferredLanguage: input.preferredLanguage,
    agriculturalId: input.agriculturalId || undefined,
    supportingInfo: input.supportingInfo || undefined,
    updatedAt: nowIso(),
  });
  const user = db.users.find((item) => item.id === auth.user.id);
  if (user) {
    user.fullName = input.fullName;
    user.email = input.email;
    user.phone = input.phone;
    user.preferredLanguage = input.preferredLanguage;
    user.updatedAt = nowIso();
  }
  appendAudit(
    db,
    actor,
    'FARMER_PROFILE_UPDATED',
    'farmer',
    farmer.id,
    `${farmer.fullName} updated their own profile information.`,
    { farmerId: farmer.id },
  );
  return farmer;
}

export function updateFarmerAdmin(
  db: Database,
  actor: AuditActor,
  farmerId: string,
  input: Partial<FarmerProfile> & { email: string },
): FarmerProfile {
  const farmer = db.farmers.find((item) => item.id === farmerId);
  if (!farmer) throw new ApiError(404, 'FARMER_NOT_FOUND', 'Farmer was not found.');
  assertEmailAvailable(db, input.email, farmer.id);
  const allowedStatus = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
  const nextStatus = input.status && allowedStatus.includes(input.status) ? input.status : farmer.status;
  Object.assign(farmer, {
    fullName: input.fullName ?? farmer.fullName,
    email: input.email,
    phone: input.phone ?? farmer.phone,
    preferredLanguage: input.preferredLanguage ?? farmer.preferredLanguage,
    commune: input.commune ?? farmer.commune,
    agriculturalId: input.agriculturalId || undefined,
    supportingInfo: input.supportingInfo || undefined,
    status: nextStatus,
    notes: input.notes || undefined,
    updatedAt: nowIso(),
  });
  const user = db.users.find((item) => item.farmerId === farmer.id);
  if (user) {
    user.fullName = farmer.fullName;
    user.email = farmer.email;
    user.phone = farmer.phone;
    user.preferredLanguage = farmer.preferredLanguage;
    user.status = nextStatus === 'SUSPENDED' ? 'SUSPENDED' : user.status === 'SUSPENDED' ? 'ACTIVE' : user.status;
    user.updatedAt = nowIso();
  }
  appendAudit(
    db,
    actor,
    'FARMER_PROFILE_UPDATED_BY_ADMIN',
    'farmer',
    farmer.id,
    `Administrator updated farmer ${farmer.fullName}.`,
    { farmerId: farmer.id, status: nextStatus },
  );
  syncAlerts(db);
  return farmer;
}
