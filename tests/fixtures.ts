import type {
  AgriculturalHolding,
  ApplicationSettings,
  AuthContext,
  CropRecord,
  Database,
  FarmerProfile,
  InventoryMovement,
  PesticideProduct,
  Plot,
  RegistrationRequest,
  TreatmentRecord,
  User,
} from '../src/domain/types';
import { permissionsForRole } from '../src/domain/permissions';
import { createEmptyDatabase } from '../server/repositories/fileMap';
import type { RegistrationInput } from '../src/domain/schemas';
import type { AuditActor } from '../server/services/audit';

export const FIXTURE_NOW = '2026-03-15T09:00:00.000Z';
export const FIXTURE_DATE = '2026-03-15';
export const FIXTURE_SEASON = 'SSN-2026';

const user = (input: Partial<User> & Pick<User, 'id' | 'role' | 'fullName' | 'email'>): User => ({
  preferredLanguage: 'en',
  status: 'ACTIVE',
  demo: true,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  ...input,
});

const farmer = (
  input: Partial<FarmerProfile> & Pick<FarmerProfile, 'id' | 'fullName' | 'email' | 'commune'>,
): FarmerProfile => ({
  phone: '+213 555 00 00 00',
  preferredLanguage: 'en',
  status: 'APPROVED',
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  ...input,
});

const holding = (
  input: Partial<AgriculturalHolding> & Pick<AgriculturalHolding, 'id' | 'name' | 'ownerFarmerId' | 'commune'>,
): AgriculturalHolding => ({
  wilaya: 'El Oued',
  totalCultivatedAreaHa: 2,
  status: 'ACTIVE',
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  ...input,
});

const plot = (input: Partial<Plot> & Pick<Plot, 'id' | 'holdingId' | 'name'>): Plot => ({
  areaHa: 2,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  ...input,
});

const crop = (
  input: Partial<CropRecord> & Pick<CropRecord, 'id' | 'holdingId' | 'plotId' | 'farmerId' | 'name'>,
): CropRecord => ({
  category: 'Vegetables',
  seasonId: FIXTURE_SEASON,
  areaHa: 2,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  ...input,
});

const product = (
  input: Partial<PesticideProduct> &
    Pick<PesticideProduct, 'id' | 'commercialName' | 'activeIngredient' | 'stockUnit' | 'verificationStatus'>,
): PesticideProduct => ({
  category: 'Insecticide',
  formulation: 'Test formulation',
  manufacturer: 'Fictional manufacturer',
  intendedCrops: ['Tomato'],
  targetPests: ['Test pest'],
  safetyInfo: 'Test fixture only. Not a real product label.',
  lowStockThreshold: 5,
  archived: false,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  ...input,
});

const movement = (
  input: Partial<InventoryMovement> &
    Pick<InventoryMovement, 'id' | 'holdingId' | 'farmerId' | 'productId' | 'quantity' | 'unit'>,
): InventoryMovement => ({
  type: 'OPENING_BALANCE',
  occurredAt: '2026-01-01',
  createdBy: 'U-DSA-001',
  createdAt: FIXTURE_NOW,
  status: 'ACTIVE',
  ...input,
});

export function makeDatabase(): Database {
  const db = createEmptyDatabase();

  const settings: ApplicationSettings = {
    ...db.settings,
    applicationName: 'El Oued Pesticide Management Platform',
    lowStockThreshold: 5,
    allowSelfRegistration: true,
    demoMode: true,
    updatedAt: FIXTURE_NOW,
  };
  db.settings = settings;

  db.users = [
    user({
      id: 'U-DSA-001',
      role: 'DSA_ADMIN',
      fullName: 'Amine Belhadj',
      email: 'amine.belhadj@demo.eloued.dz',
      phone: '+213 555 01 01 01',
    }),
    user({
      id: 'U-CHM-001',
      role: 'CHAMBER_ADMIN',
      fullName: 'Nadia Khelifi',
      email: 'nadia.khelifi@demo.eloued.dz',
      phone: '+213 555 02 02 02',
      scopeCommunes: ['Guemar'],
    }),
    user({
      id: 'U-FRM-001',
      role: 'FARMER',
      fullName: 'Youcef Benali',
      email: 'youcef.benali@demo.eloued.dz',
      phone: '+213 555 03 03 03',
      farmerId: 'FRM-001',
    }),
    user({
      id: 'U-FRM-002',
      role: 'FARMER',
      fullName: 'Salima Rahmani',
      email: 'salima.rahmani@demo.eloued.dz',
      phone: '+213 555 04 04 04',
      farmerId: 'FRM-002',
    }),
  ];

  db.farmers = [
    farmer({
      id: 'FRM-001',
      userId: 'U-FRM-001',
      fullName: 'Youcef Benali',
      email: 'youcef.benali@demo.eloued.dz',
      commune: 'Guemar',
      agriculturalId: 'AG-001',
    }),
    farmer({
      id: 'FRM-002',
      userId: 'U-FRM-002',
      fullName: 'Salima Rahmani',
      email: 'salima.rahmani@demo.eloued.dz',
      commune: 'Debila',
      agriculturalId: 'AG-002',
    }),
    farmer({
      id: 'FRM-003',
      fullName: 'Hocine Dhaouadi',
      email: 'hocine.dhaouadi@demo.eloued.dz',
      commune: 'Guemar',
      status: 'PENDING',
      proposedHoldingName: 'Dhaouadi Oasis',
      proposedAreaHa: 1.5,
      mainCrops: ['Tomato'],
    }),
  ];

  db.registrationRequests = [
    {
      id: 'REG-001',
      farmerId: 'FRM-001',
      submittedAt: '2026-01-05T08:00:00.000Z',
      status: 'APPROVED',
      source: 'SELF',
      reviewedAt: '2026-01-06T08:00:00.000Z',
      reviewedBy: 'U-DSA-001',
    },
    {
      id: 'REG-002',
      farmerId: 'FRM-002',
      submittedAt: '2026-01-07T08:00:00.000Z',
      status: 'APPROVED',
      source: 'ADMIN',
      reviewedAt: '2026-01-07T08:00:00.000Z',
      reviewedBy: 'U-DSA-001',
    },
    {
      id: 'REG-003',
      farmerId: 'FRM-003',
      submittedAt: '2026-03-10T08:00:00.000Z',
      status: 'PENDING',
      source: 'SELF',
    } satisfies RegistrationRequest,
  ];

  db.holdings = [
    holding({
      id: 'HLD-001',
      name: 'Oasis Benali',
      ownerFarmerId: 'FRM-001',
      commune: 'Guemar',
      latitude: 33.4021,
      longitude: 6.9102,
      totalCultivatedAreaHa: 2,
    }),
    holding({
      id: 'HLD-002',
      name: 'Rahmani Farm',
      ownerFarmerId: 'FRM-002',
      commune: 'Debila',
      totalCultivatedAreaHa: 2,
    }),
  ];

  db.plots = [
    plot({ id: 'PLT-001', holdingId: 'HLD-001', name: 'North plot', areaHa: 2 }),
    plot({ id: 'PLT-002', holdingId: 'HLD-002', name: 'South plot', areaHa: 2 }),
  ];

  db.crops = [
    crop({
      id: 'CRP-001',
      holdingId: 'HLD-001',
      plotId: 'PLT-001',
      farmerId: 'FRM-001',
      name: 'Tomato',
    }),
    crop({
      id: 'CRP-002',
      holdingId: 'HLD-002',
      plotId: 'PLT-002',
      farmerId: 'FRM-002',
      name: 'Potato',
    }),
  ];

  db.seasons = [
    {
      id: FIXTURE_SEASON,
      label: '2025–2026',
      startDate: '2025-10-01',
      endDate: '2026-06-30',
      status: 'ACTIVE',
    },
  ];

  db.pesticides = [
    product({
      id: 'PRD-VOL',
      commercialName: 'Demo Volume Product',
      activeIngredient: 'Fictional ingredient A',
      stockUnit: 'L',
      verificationStatus: 'VERIFIED',
      registrationReference: 'TEST-VERIFIED-REFERENCE',
      referenceDose: 2,
      referenceDoseUnit: 'L/ha',
      referenceSource: 'Test fixture (not a real registration)',
      lowStockThreshold: 5,
    }),
    product({
      id: 'PRD-MASS',
      commercialName: 'Demo Mass Product',
      activeIngredient: 'Fictional ingredient B',
      stockUnit: 'kg',
      verificationStatus: 'DEMO',
      referenceDose: 1.5,
      referenceDoseUnit: 'kg/ha',
      referenceSource: 'Demonstration reference dose',
      lowStockThreshold: 2,
    }),
    product({
      id: 'PRD-NOREF',
      commercialName: 'Demo No Reference Product',
      activeIngredient: 'Fictional ingredient C',
      stockUnit: 'L',
      verificationStatus: 'UNVERIFIED',
      lowStockThreshold: 1,
    }),
  ];

  db.inventoryMovements = [
    movement({
      id: 'MOV-OPEN-VOL',
      holdingId: 'HLD-001',
      farmerId: 'FRM-001',
      productId: 'PRD-VOL',
      quantity: 20,
      unit: 'L',
    }),
    movement({
      id: 'MOV-OPEN-MASS',
      holdingId: 'HLD-001',
      farmerId: 'FRM-001',
      productId: 'PRD-MASS',
      quantity: 1,
      unit: 'kg',
      occurredAt: '2026-01-02',
    }),
    movement({
      id: 'MOV-OPEN-H2',
      holdingId: 'HLD-002',
      farmerId: 'FRM-002',
      productId: 'PRD-VOL',
      quantity: 6,
      unit: 'L',
      occurredAt: '2026-01-03',
    }),
  ];

  db.treatments = [];
  db.alerts = [];
  db.auditLog = [];

  return db;
}

export function authFor(db: Database, userId: string): AuthContext {
  const found = db.users.find((item) => item.id === userId);
  if (!found) throw new Error(`Fixture user ${userId} does not exist.`);
  return {
    user: found,
    role: found.role,
    permissions: permissionsForRole(found.role),
    farmerId: found.farmerId,
    scopeCommunes: found.scopeCommunes,
  };
}

export function actorFor(db: Database, userId: string): AuditActor {
  const found = db.users.find((item) => item.id === userId);
  if (!found) throw new Error(`Fixture user ${userId} does not exist.`);
  return { id: found.id, name: found.fullName, role: found.role };
}

export function makeTreatment(overrides: Partial<TreatmentRecord> = {}): TreatmentRecord {
  return {
    id: 'TRT-MANUAL-001',
    farmerId: 'FRM-001',
    holdingId: 'HLD-001',
    plotId: 'PLT-001',
    cropId: 'CRP-001',
    seasonId: FIXTURE_SEASON,
    treatmentDate: FIXTURE_DATE,
    productId: 'PRD-VOL',
    activeIngredientSnapshot: 'Fictional ingredient A',
    target: 'Test pest',
    treatedAreaHa: 1,
    totalCropAreaHa: 2,
    appliedDose: 2,
    appliedDoseUnit: 'L/ha',
    referenceDose: 2,
    referenceDoseUnit: 'L/ha',
    referenceDoseStatus: 'VERIFIED',
    quantityApplied: 2,
    quantityUnit: 'L',
    status: 'ACTIVE',
    revision: 1,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    createdBy: 'U-DSA-001',
    ...overrides,
  };
}

export function makeRegistrationInput(overrides: Partial<RegistrationInput> = {}): RegistrationInput {
  return {
    fullName: 'New Farmer',
    email: 'new.farmer@demo.eloued.dz',
    phone: '+213 555 09 09 09',
    preferredLanguage: 'en',
    holdingName: 'New Oasis',
    commune: 'Guemar',
    cultivatedAreaHa: 1.25,
    mainCrops: 'Tomato, Potato',
    agriculturalId: 'AG-NEW',
    supportingInfo: 'Submitted in a test.',
    consent: true,
    ...overrides,
  };
}
