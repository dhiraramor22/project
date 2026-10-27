/**
 * Generates the fictional demonstration dataset in data/demo-seed/.
 * Run with: npm run seed:generate
 *
 * All names, products, doses, registrations and coordinates are fictional and must
 * not be treated as official agricultural or regulatory data.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveAlertCandidates, mergeAlerts } from '../src/domain/alerts';
import { currentStock } from '../src/domain/inventory';
import type {
  AgriculturalHolding,
  AgriculturalSeason,
  Alert,
  ApplicationSettings,
  AuditEvent,
  CropRecord,
  Database,
  FarmerProfile,
  InventoryMovement,
  PesticideProduct,
  Plot,
  RegistrationRequest,
  TFIConfiguration,
  TreatmentRecord,
  User,
} from '../src/domain/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const SEED_DIR = path.join(ROOT, 'data', 'demo-seed');
const STAMP = '2026-10-20T10:00:00.000Z';

function at(date: string, time = '08:00:00.000Z'): string {
  return `${date}T${time}`;
}

function isoNow(): string {
  return STAMP;
}

const users: User[] = [
  {
    id: 'U-DSA-001',
    role: 'DSA_ADMIN',
    fullName: 'Amine Belhadj',
    email: 'amine.belhadj@demo.local',
    phone: '+213 555 010 101',
    preferredLanguage: 'en',
    status: 'ACTIVE',
    demo: true,
    createdAt: at('2024-01-10'),
    updatedAt: STAMP,
  },
  {
    id: 'U-CHM-001',
    role: 'CHAMBER_ADMIN',
    fullName: 'Nadia Khelifi',
    email: 'nadia.khelifi@demo.local',
    phone: '+213 555 010 202',
    preferredLanguage: 'fr',
    scopeCommunes: ['Guemar', 'Debila', 'Robbah'],
    status: 'ACTIVE',
    demo: true,
    createdAt: at('2024-01-10'),
    updatedAt: STAMP,
  },
  {
    id: 'U-FRM-001',
    role: 'FARMER',
    fullName: 'Youcef Benali',
    email: 'youcef.benali@demo.local',
    phone: '+213 555 010 303',
    preferredLanguage: 'en',
    farmerId: 'FRM-001',
    status: 'ACTIVE',
    demo: true,
    createdAt: at('2025-09-02'),
    updatedAt: STAMP,
  },
  {
    id: 'U-FRM-002',
    role: 'FARMER',
    fullName: 'Amina Saadi',
    email: 'amina.saadi@demo.local',
    phone: '+213 555 010 404',
    preferredLanguage: 'fr',
    farmerId: 'FRM-002',
    status: 'INVITED',
    demo: false,
    createdAt: at('2025-09-03'),
    updatedAt: STAMP,
  },
  {
    id: 'U-FRM-003',
    role: 'FARMER',
    fullName: 'Brahim Haddadi',
    email: 'brahim.haddadi@demo.local',
    phone: '+213 555 010 505',
    preferredLanguage: 'ar',
    farmerId: 'FRM-003',
    status: 'INVITED',
    demo: false,
    createdAt: at('2025-09-04'),
    updatedAt: STAMP,
  },
  {
    id: 'U-FRM-004',
    role: 'FARMER',
    fullName: 'Salima Mansouri',
    email: 'salima.mansouri@demo.local',
    phone: '+213 555 010 606',
    preferredLanguage: 'ar',
    farmerId: 'FRM-004',
    status: 'INVITED',
    demo: false,
    createdAt: at('2025-09-05'),
    updatedAt: STAMP,
  },
  {
    id: 'U-FRM-005',
    role: 'FARMER',
    fullName: 'Karim Zerguine',
    email: 'karim.zerguine@demo.local',
    phone: '+213 555 010 707',
    preferredLanguage: 'fr',
    farmerId: 'FRM-005',
    status: 'INVITED',
    demo: false,
    createdAt: at('2025-09-06'),
    updatedAt: STAMP,
  },
  {
    id: 'U-FRM-008',
    role: 'FARMER',
    fullName: 'Omar Kaddour',
    email: 'omar.kaddour@demo.local',
    phone: '+213 555 010 808',
    preferredLanguage: 'en',
    farmerId: 'FRM-008',
    status: 'SUSPENDED',
    demo: false,
    createdAt: at('2025-09-07'),
    updatedAt: STAMP,
  },
];

const farmers: FarmerProfile[] = [
  {
    id: 'FRM-001',
    userId: 'U-FRM-001',
    fullName: 'Youcef Benali',
    email: 'youcef.benali@demo.local',
    phone: '+213 555 010 303',
    preferredLanguage: 'en',
    commune: 'El Oued',
    agriculturalId: 'DEMO-AGRI-001',
    proposedHoldingName: 'Oasis Benali',
    proposedAreaHa: 8.5,
    mainCrops: ['Tomato', 'Date palm'],
    supportingInfo: 'Fictional demonstration farmer profile.',
    status: 'APPROVED',
    createdAt: at('2025-09-02'),
    updatedAt: STAMP,
    approvedAt: at('2025-09-03'),
    approvedBy: 'U-DSA-001',
    notes: 'Demo record only.',
  },
  {
    id: 'FRM-002',
    userId: 'U-FRM-002',
    fullName: 'Amina Saadi',
    email: 'amina.saadi@demo.local',
    phone: '+213 555 010 404',
    preferredLanguage: 'fr',
    commune: 'Guemar',
    agriculturalId: 'DEMO-AGRI-002',
    proposedHoldingName: 'Palm Grove Saadi',
    proposedAreaHa: 12,
    mainCrops: ['Tomato', 'Pepper'],
    status: 'APPROVED',
    createdAt: at('2025-09-03'),
    updatedAt: STAMP,
    approvedAt: at('2025-09-04'),
    approvedBy: 'U-DSA-001',
  },
  {
    id: 'FRM-003',
    userId: 'U-FRM-003',
    fullName: 'Brahim Haddadi',
    email: 'brahim.haddadi@demo.local',
    phone: '+213 555 010 505',
    preferredLanguage: 'ar',
    commune: 'Debila',
    proposedHoldingName: 'Debila Fields',
    proposedAreaHa: 6,
    mainCrops: ['Onion'],
    status: 'APPROVED',
    createdAt: at('2025-09-04'),
    updatedAt: STAMP,
    approvedAt: at('2025-09-05'),
    approvedBy: 'U-DSA-001',
  },
  {
    id: 'FRM-004',
    userId: 'U-FRM-004',
    fullName: 'Salima Mansouri',
    email: 'salima.mansouri@demo.local',
    phone: '+213 555 010 606',
    preferredLanguage: 'ar',
    commune: 'Robbah',
    proposedHoldingName: 'Robbah Plot',
    proposedAreaHa: 4.5,
    mainCrops: ['Alfalfa'],
    status: 'APPROVED',
    createdAt: at('2025-09-05'),
    updatedAt: STAMP,
    approvedAt: at('2025-09-06'),
    approvedBy: 'U-DSA-001',
  },
  {
    id: 'FRM-005',
    userId: 'U-FRM-005',
    fullName: 'Karim Zerguine',
    email: 'karim.zerguine@demo.local',
    phone: '+213 555 010 707',
    preferredLanguage: 'fr',
    commune: 'Reguiba',
    proposedHoldingName: 'Reguiba Farm',
    proposedAreaHa: 10,
    mainCrops: ['Maize'],
    status: 'APPROVED',
    createdAt: at('2025-09-06'),
    updatedAt: STAMP,
    approvedAt: at('2025-09-07'),
    approvedBy: 'U-DSA-001',
  },
  {
    id: 'FRM-006',
    fullName: 'Fatiha Boudjemaa',
    email: 'fatiha.boudjemaa@demo.local',
    phone: '+213 555 010 909',
    preferredLanguage: 'ar',
    commune: 'El Oued',
    agriculturalId: 'DEMO-AGRI-006',
    proposedHoldingName: 'Small Oasis',
    proposedAreaHa: 2.5,
    mainCrops: ['Tomato', 'Onion'],
    supportingInfo: 'Fictional pending registration used to demonstrate the review workflow.',
    status: 'PENDING',
    createdAt: at('2026-10-18', '09:15:00.000Z'),
    updatedAt: at('2026-10-18', '09:15:00.000Z'),
  },
  {
    id: 'FRM-007',
    fullName: 'Mohamed Lamine',
    email: 'mohamed.lamine@demo.local',
    phone: '+213 555 010 910',
    preferredLanguage: 'fr',
    commune: 'Hassi Khelifa',
    proposedHoldingName: 'Hassi Sand Plot',
    proposedAreaHa: 3.2,
    mainCrops: ['Melon'],
    supportingInfo: 'Fictional pending registration used to demonstrate the review workflow.',
    status: 'PENDING',
    createdAt: at('2025-10-19', '11:40:00.000Z'),
    updatedAt: at('2025-10-19', '11:40:00.000Z'),
  },
  {
    id: 'FRM-008',
    userId: 'U-FRM-008',
    fullName: 'Omar Kaddour',
    email: 'omar.kaddour@demo.local',
    phone: '+213 555 010 808',
    preferredLanguage: 'en',
    commune: 'Guemar',
    proposedHoldingName: 'Kaddour Plot',
    proposedAreaHa: 1.5,
    status: 'SUSPENDED',
    createdAt: at('2025-09-07'),
    updatedAt: at('2026-09-20', '12:00:00.000Z'),
    approvedAt: at('2025-09-08'),
    approvedBy: 'U-DSA-001',
    suspendedAt: at('2026-09-20', '12:00:00.000Z'),
    notes: 'Fictional suspended record for status demonstration.',
  },
];

const registrationRequests: RegistrationRequest[] = [
  { id: 'REG-001', farmerId: 'FRM-001', submittedAt: at('2025-09-02'), status: 'APPROVED', source: 'SELF', reviewedBy: 'U-DSA-001', reviewedAt: at('2025-09-03'), reviewNotes: 'Demo approval.' },
  { id: 'REG-002', farmerId: 'FRM-002', submittedAt: at('2025-09-03'), status: 'APPROVED', source: 'SELF', reviewedBy: 'U-DSA-001', reviewedAt: at('2025-09-04'), reviewNotes: 'Demo approval.' },
  { id: 'REG-003', farmerId: 'FRM-003', submittedAt: at('2025-09-04'), status: 'APPROVED', source: 'SELF', reviewedBy: 'U-DSA-001', reviewedAt: at('2025-09-05'), reviewNotes: 'Demo approval.' },
  { id: 'REG-004', farmerId: 'FRM-004', submittedAt: at('2025-09-05'), status: 'APPROVED', source: 'SELF', reviewedBy: 'U-DSA-001', reviewedAt: at('2025-09-06'), reviewNotes: 'Demo approval.' },
  { id: 'REG-005', farmerId: 'FRM-005', submittedAt: at('2025-09-06'), status: 'APPROVED', source: 'ADMIN', reviewedBy: 'U-DSA-001', reviewedAt: at('2025-09-07'), reviewNotes: 'Administrator-created demo account; invitation simulated.' },
  { id: 'REG-006', farmerId: 'FRM-006', submittedAt: at('2026-10-18', '09:15:00.000Z'), status: 'PENDING', source: 'SELF' },
  { id: 'REG-007', farmerId: 'FRM-007', submittedAt: at('2025-10-19', '11:40:00.000Z'), status: 'PENDING', source: 'SELF' },
  { id: 'REG-008', farmerId: 'FRM-008', submittedAt: at('2025-09-07'), status: 'APPROVED', source: 'SELF', reviewedBy: 'U-DSA-001', reviewedAt: at('2025-09-08'), reviewNotes: 'Demo approval; later suspended.' },
];

const seasons: AgriculturalSeason[] = [
  { id: 'SSN-2024', label: '2024/2025', startDate: '2024-09-01', endDate: '2025-06-30', status: 'CLOSED' },
  { id: 'SSN-2025', label: '2025/2026', startDate: '2025-09-01', endDate: '2026-06-30', status: 'CLOSED' },
  { id: 'SSN-2026', label: '2026/2027', startDate: '2026-09-01', endDate: '2027-06-30', status: 'ACTIVE' },
];

const holdings: AgriculturalHolding[] = [
  {
    id: 'HLD-001',
    name: 'Oasis Benali',
    ownerFarmerId: 'FRM-001',
    wilaya: 'El Oued',
    commune: 'El Oued',
    address: 'Fictional address, El Oued',
    latitude: 33.3562,
    longitude: 6.8724,
    totalCultivatedAreaHa: 8.5,
    status: 'ACTIVE',
    coordinatesAreDemo: true,
    createdAt: at('2025-09-03'),
    updatedAt: STAMP,
  },
  {
    id: 'HLD-002',
    name: 'Palm Grove Saadi',
    ownerFarmerId: 'FRM-002',
    wilaya: 'El Oued',
    commune: 'Guemar',
    address: 'Fictional address, Guemar',
    latitude: 33.4318,
    longitude: 6.9421,
    totalCultivatedAreaHa: 12,
    status: 'ACTIVE',
    coordinatesAreDemo: true,
    createdAt: at('2025-09-04'),
    updatedAt: STAMP,
  },
  {
    id: 'HLD-003',
    name: 'Debila Fields',
    ownerFarmerId: 'FRM-003',
    wilaya: 'El Oued',
    commune: 'Debila',
    latitude: 33.5125,
    longitude: 6.9302,
    totalCultivatedAreaHa: 6,
    status: 'ACTIVE',
    coordinatesAreDemo: true,
    createdAt: at('2025-09-05'),
    updatedAt: STAMP,
  },
  {
    id: 'HLD-004',
    name: 'Robbah Plot',
    ownerFarmerId: 'FRM-004',
    wilaya: 'El Oued',
    commune: 'Robbah',
    latitude: 33.2784,
    longitude: 6.9056,
    totalCultivatedAreaHa: 4.5,
    status: 'ACTIVE',
    coordinatesAreDemo: true,
    createdAt: at('2025-09-06'),
    updatedAt: STAMP,
  },
  {
    id: 'HLD-005',
    name: 'Reguiba Farm',
    ownerFarmerId: 'FRM-005',
    wilaya: 'El Oued',
    commune: 'Reguiba',
    totalCultivatedAreaHa: 10,
    status: 'ACTIVE',
    createdAt: at('2025-09-07'),
    updatedAt: STAMP,
  },
];

const plots: Plot[] = [
  { id: 'PLT-001', holdingId: 'HLD-001', name: 'North field', areaHa: 5, soilType: 'Sandy', notes: 'Fictional demo plot.', createdAt: at('2025-09-03'), updatedAt: STAMP },
  { id: 'PLT-002', holdingId: 'HLD-001', name: 'Palm rows', areaHa: 3.5, soilType: 'Sandy', createdAt: at('2025-09-03'), updatedAt: STAMP },
  { id: 'PLT-003', holdingId: 'HLD-002', name: 'East pivot', areaHa: 7, soilType: 'Sandy loam', createdAt: at('2025-09-04'), updatedAt: STAMP },
  { id: 'PLT-004', holdingId: 'HLD-002', name: 'West strip', areaHa: 5, soilType: 'Sandy', createdAt: at('2025-09-04'), updatedAt: STAMP },
  { id: 'PLT-005', holdingId: 'HLD-003', name: 'Main plot', areaHa: 6, soilType: 'Sandy', createdAt: at('2025-09-05'), updatedAt: STAMP },
  { id: 'PLT-006', holdingId: 'HLD-004', name: 'Plot A', areaHa: 4.5, soilType: 'Sandy loam', createdAt: at('2025-09-06'), updatedAt: STAMP },
  { id: 'PLT-007', holdingId: 'HLD-005', name: 'Pivot 1', areaHa: 10, soilType: 'Sandy', createdAt: at('2025-09-07'), updatedAt: STAMP },
];

interface CropSeed {
  id: string;
  holdingId: string;
  plotId: string;
  farmerId: string;
  name: string;
  category: string;
  seasonId: string;
  areaHa: number;
  plantingDate?: string;
  harvestDate?: string;
}

const cropSeeds: CropSeed[] = [
  { id: 'CRP-001', holdingId: 'HLD-001', plotId: 'PLT-001', farmerId: 'FRM-001', name: 'Tomato', category: 'Vegetables', seasonId: 'SSN-2026', areaHa: 4.5, plantingDate: '2026-09-10' },
  { id: 'CRP-002', holdingId: 'HLD-001', plotId: 'PLT-001', farmerId: 'FRM-001', name: 'Melon', category: 'Vegetables', seasonId: 'SSN-2026', areaHa: 0.5, plantingDate: '2026-09-15' },
  { id: 'CRP-003', holdingId: 'HLD-001', plotId: 'PLT-002', farmerId: 'FRM-001', name: 'Date palm', category: 'Fruit trees', seasonId: 'SSN-2026', areaHa: 3.5 },
  { id: 'CRP-004', holdingId: 'HLD-002', plotId: 'PLT-003', farmerId: 'FRM-002', name: 'Tomato', category: 'Vegetables', seasonId: 'SSN-2026', areaHa: 7, plantingDate: '2026-09-12' },
  { id: 'CRP-005', holdingId: 'HLD-002', plotId: 'PLT-004', farmerId: 'FRM-002', name: 'Pepper', category: 'Vegetables', seasonId: 'SSN-2026', areaHa: 5, plantingDate: '2026-09-18' },
  { id: 'CRP-006', holdingId: 'HLD-003', plotId: 'PLT-005', farmerId: 'FRM-003', name: 'Onion', category: 'Vegetables', seasonId: 'SSN-2026', areaHa: 6, plantingDate: '2026-09-20' },
  { id: 'CRP-007', holdingId: 'HLD-004', plotId: 'PLT-006', farmerId: 'FRM-004', name: 'Alfalfa', category: 'Fodder', seasonId: 'SSN-2026', areaHa: 4.5, plantingDate: '2026-09-14' },
  { id: 'CRP-008', holdingId: 'HLD-005', plotId: 'PLT-007', farmerId: 'FRM-005', name: 'Maize', category: 'Cereals', seasonId: 'SSN-2026', areaHa: 10, plantingDate: '2026-09-22' },
  { id: 'CRP-009', holdingId: 'HLD-001', plotId: 'PLT-001', farmerId: 'FRM-001', name: 'Tomato', category: 'Vegetables', seasonId: 'SSN-2025', areaHa: 5, plantingDate: '2025-09-15', harvestDate: '2026-04-30' },
  { id: 'CRP-010', holdingId: 'HLD-001', plotId: 'PLT-002', farmerId: 'FRM-001', name: 'Date palm', category: 'Fruit trees', seasonId: 'SSN-2025', areaHa: 3.5 },
  { id: 'CRP-011', holdingId: 'HLD-002', plotId: 'PLT-003', farmerId: 'FRM-002', name: 'Potato', category: 'Vegetables', seasonId: 'SSN-2025', areaHa: 7, plantingDate: '2025-10-01', harvestDate: '2026-02-20' },
  { id: 'CRP-012', holdingId: 'HLD-003', plotId: 'PLT-005', farmerId: 'FRM-003', name: 'Onion', category: 'Vegetables', seasonId: 'SSN-2025', areaHa: 6, plantingDate: '2025-10-10', harvestDate: '2026-05-10' },
  { id: 'CRP-013', holdingId: 'HLD-004', plotId: 'PLT-006', farmerId: 'FRM-004', name: 'Alfalfa', category: 'Fodder', seasonId: 'SSN-2025', areaHa: 4.5, plantingDate: '2025-09-20' },
  { id: 'CRP-014', holdingId: 'HLD-005', plotId: 'PLT-007', farmerId: 'FRM-005', name: 'Maize', category: 'Cereals', seasonId: 'SSN-2025', areaHa: 10, plantingDate: '2025-09-25', harvestDate: '2026-05-20' },
  { id: 'CRP-015', holdingId: 'HLD-002', plotId: 'PLT-003', farmerId: 'FRM-002', name: 'Tomato', category: 'Vegetables', seasonId: 'SSN-2024', areaHa: 7, plantingDate: '2024-10-05', harvestDate: '2025-03-30' },
];

const crops: CropRecord[] = cropSeeds.map((crop) => ({
  ...crop,
  notes: 'Fictional demonstration crop record.',
  createdAt: at(crop.plantingDate ?? '2025-09-01'),
  updatedAt: STAMP,
}));

const products: PesticideProduct[] = [
  {
    id: 'PST-001',
    commercialName: 'Oasis Guard 250 EC (demo)',
    activeIngredient: 'Fictional compound A (demonstration only)',
    category: 'Insecticide',
    formulation: 'Emulsifiable concentrate (EC)',
    manufacturer: 'Demo Agro Supplies',
    intendedCrops: ['Tomato', 'Pepper'],
    targetPests: ['Fictional leaf pest complex'],
    referenceDose: 0.75,
    referenceDoseUnit: 'L/ha',
    referenceSource: 'Fictional demonstration label — not a verified registration',
    safetyInfo: 'DEMONSTRATION DATA ONLY. This product does not exist. Always follow the approved local label and safety instructions.',
    preHarvestIntervalDays: 7,
    reEntryIntervalHours: 24,
    stockUnit: 'L',
    lowStockThreshold: 25,
    verificationStatus: 'DEMO',
    archived: false,
    createdAt: at('2024-01-15'),
    updatedAt: STAMP,
  },
  {
    id: 'PST-002',
    commercialName: 'Sahara Shield 80 WP (demo)',
    activeIngredient: 'Fictional compound B (demonstration only)',
    category: 'Fungicide',
    formulation: 'Wettable powder (WP)',
    manufacturer: 'Demo Agro Supplies',
    intendedCrops: ['Tomato', 'Potato'],
    targetPests: ['Fictional foliar disease'],
    referenceDose: 1.2,
    referenceDoseUnit: 'kg/ha',
    referenceSource: 'Fictional demonstration label — not a verified registration',
    safetyInfo: 'DEMONSTRATION DATA ONLY. This product does not exist. Always follow the approved local label and safety instructions.',
    preHarvestIntervalDays: 10,
    reEntryIntervalHours: 12,
    stockUnit: 'kg',
    lowStockThreshold: 8,
    verificationStatus: 'DEMO',
    archived: false,
    createdAt: at('2024-01-15'),
    updatedAt: STAMP,
  },
  {
    id: 'PST-003',
    commercialName: 'Palm Care Oil 95 (demo)',
    activeIngredient: 'Fictional mineral oil (demonstration only)',
    category: 'Insecticide',
    formulation: 'Emulsifiable concentrate (EC)',
    manufacturer: 'Demo Agro Supplies',
    intendedCrops: ['Date palm', 'Alfalfa'],
    targetPests: ['Fictional scale insect'],
    referenceDose: 3,
    referenceDoseUnit: 'L/ha',
    referenceSource: 'Fictional demonstration label — not a verified registration',
    safetyInfo: 'DEMONSTRATION DATA ONLY. This product does not exist. Always follow the approved local label and safety instructions.',
    preHarvestIntervalDays: 3,
    reEntryIntervalHours: 8,
    stockUnit: 'L',
    lowStockThreshold: 20,
    verificationStatus: 'DEMO',
    archived: false,
    createdAt: at('2024-01-20'),
    updatedAt: STAMP,
  },
  {
    id: 'PST-004',
    commercialName: 'Desert Root 50 SL (demo)',
    activeIngredient: 'Fictional compound C (demonstration only)',
    category: 'Herbicide',
    formulation: 'Soluble concentrate (SL)',
    manufacturer: 'Sample Crop Care',
    intendedCrops: ['Onion'],
    targetPests: ['Fictional grass weeds'],
    referenceDose: 1.5,
    referenceDoseUnit: 'L/ha',
    referenceSource: 'Fictional demonstration label — not a verified registration',
    safetyInfo: 'DEMONSTRATION DATA ONLY. This product does not exist. Always follow the approved local label and safety instructions.',
    preHarvestIntervalDays: 14,
    reEntryIntervalHours: 24,
    stockUnit: 'L',
    lowStockThreshold: 12,
    verificationStatus: 'DEMO',
    archived: false,
    createdAt: at('2024-02-01'),
    updatedAt: STAMP,
  },
  {
    id: 'PST-005',
    commercialName: 'Tomato Fortify WP (demo)',
    activeIngredient: 'Fictional compound D (demonstration only)',
    category: 'Fungicide',
    formulation: 'Wettable powder (WP)',
    manufacturer: 'Sample Crop Care',
    intendedCrops: ['Pepper'],
    targetPests: ['Fictional fruit rot'],
    referenceDose: 2,
    referenceDoseUnit: 'kg/ha',
    referenceSource: 'Fictional demonstration label — not a verified registration',
    safetyInfo: 'DEMONSTRATION DATA ONLY. This product does not exist. Always follow the approved local label and safety instructions.',
    preHarvestIntervalDays: 5,
    reEntryIntervalHours: 12,
    stockUnit: 'kg',
    lowStockThreshold: 5,
    verificationStatus: 'DEMO',
    archived: false,
    createdAt: at('2024-02-05'),
    updatedAt: STAMP,
  },
  {
    id: 'PST-006',
    commercialName: 'Unverified Sample 45 SC',
    activeIngredient: 'Unknown sample ingredient',
    category: 'Insecticide',
    formulation: 'Suspension concentrate (SC)',
    manufacturer: 'Unverified sample supplier',
    intendedCrops: ['Onion'],
    targetPests: ['Unverified target'],
    safetyInfo: 'DEMONSTRATION DATA ONLY. No verified reference dose or registration exists for this sample record. Do not use it as agronomic advice.',
    stockUnit: 'L',
    lowStockThreshold: 5,
    verificationStatus: 'UNVERIFIED',
    archived: false,
    createdAt: at('2024-03-01'),
    updatedAt: STAMP,
  },
  {
    id: 'PST-007',
    commercialName: 'Legacy Demo 20 WP (archived)',
    activeIngredient: 'Fictional legacy compound',
    category: 'Fungicide',
    formulation: 'Wettable powder (WP)',
    manufacturer: 'Demo Agro Supplies',
    intendedCrops: ['Tomato'],
    targetPests: ['Fictional target'],
    referenceDose: 1,
    referenceDoseUnit: 'kg/ha',
    referenceSource: 'Fictional demonstration label — not a verified registration',
    safetyInfo: 'DEMONSTRATION DATA ONLY. Archived sample record.',
    stockUnit: 'kg',
    lowStockThreshold: 5,
    verificationStatus: 'DEMO',
    archived: true,
    createdAt: at('2023-05-01'),
    updatedAt: STAMP,
  },
];

const productMap = new Map(products.map((product) => [product.id, product]));
const movements: InventoryMovement[] = [];

function addMovement(input: Omit<InventoryMovement, 'createdAt' | 'status'> & { createdAt?: string }): InventoryMovement {
  const movement: InventoryMovement = {
    ...input,
    type: input.type,
    createdAt: input.createdAt ?? at(input.occurredAt, '08:30:00.000Z'),
    status: 'ACTIVE',
  };
  movements.push(movement);
  return movement;
}

// Opening balances and receipts.
addMovement({ id: 'MOV-001', holdingId: 'HLD-001', farmerId: 'FRM-001', productId: 'PST-001', type: 'OPENING_BALANCE', occurredAt: '2025-09-01', quantity: 12, unit: 'L', notes: 'Fictional opening balance.', createdBy: 'U-FRM-001' });
addMovement({ id: 'MOV-002', holdingId: 'HLD-001', farmerId: 'FRM-001', productId: 'PST-002', type: 'OPENING_BALANCE', occurredAt: '2025-09-01', quantity: 20, unit: 'kg', notes: 'Fictional opening balance.', createdBy: 'U-FRM-001' });
addMovement({ id: 'MOV-003', holdingId: 'HLD-001', farmerId: 'FRM-001', productId: 'PST-001', type: 'RECEIPT', occurredAt: '2026-09-10', quantity: 6, unit: 'L', supplierOrReference: 'DEMO-SUPPLIER-01', notes: 'Fictional receipt.', createdBy: 'U-FRM-001' });
addMovement({ id: 'MOV-004', holdingId: 'HLD-001', farmerId: 'FRM-001', productId: 'PST-002', type: 'RECEIPT', occurredAt: '2026-09-10', quantity: 10, unit: 'kg', supplierOrReference: 'DEMO-SUPPLIER-01', createdBy: 'U-FRM-001' });
addMovement({ id: 'MOV-005', holdingId: 'HLD-001', farmerId: 'FRM-001', productId: 'PST-003', type: 'OPENING_BALANCE', occurredAt: '2026-09-01', quantity: 15, unit: 'L', createdBy: 'U-FRM-001' });

addMovement({ id: 'MOV-006', holdingId: 'HLD-002', farmerId: 'FRM-002', productId: 'PST-001', type: 'OPENING_BALANCE', occurredAt: '2024-09-01', quantity: 20, unit: 'L', createdBy: 'U-FRM-002' });
addMovement({ id: 'MOV-007', holdingId: 'HLD-002', farmerId: 'FRM-002', productId: 'PST-001', type: 'RECEIPT', occurredAt: '2025-09-01', quantity: 60, unit: 'L', supplierOrReference: 'DEMO-SUPPLIER-02', createdBy: 'U-FRM-002' });
addMovement({ id: 'MOV-008', holdingId: 'HLD-002', farmerId: 'FRM-002', productId: 'PST-001', type: 'RECEIPT', occurredAt: '2026-09-10', quantity: 20, unit: 'L', supplierOrReference: 'DEMO-SUPPLIER-02', createdBy: 'U-FRM-002' });
addMovement({ id: 'MOV-009', holdingId: 'HLD-002', farmerId: 'FRM-002', productId: 'PST-002', type: 'OPENING_BALANCE', occurredAt: '2025-09-01', quantity: 20, unit: 'kg', createdBy: 'U-FRM-002' });
addMovement({ id: 'MOV-010', holdingId: 'HLD-002', farmerId: 'FRM-002', productId: 'PST-002', type: 'RECEIPT', occurredAt: '2026-09-10', quantity: 10, unit: 'kg', supplierOrReference: 'DEMO-SUPPLIER-02', createdBy: 'U-FRM-002' });
addMovement({ id: 'MOV-011', holdingId: 'HLD-002', farmerId: 'FRM-002', productId: 'PST-004', type: 'OPENING_BALANCE', occurredAt: '2025-09-01', quantity: 6, unit: 'L', createdBy: 'U-FRM-002' });
addMovement({ id: 'MOV-012', holdingId: 'HLD-002', farmerId: 'FRM-002', productId: 'PST-004', type: 'RECEIPT', occurredAt: '2026-09-10', quantity: 5, unit: 'L', supplierOrReference: 'DEMO-SUPPLIER-02', createdBy: 'U-FRM-002' });
addMovement({ id: 'MOV-013', holdingId: 'HLD-002', farmerId: 'FRM-002', productId: 'PST-005', type: 'OPENING_BALANCE', occurredAt: '2026-09-01', quantity: 10, unit: 'kg', createdBy: 'U-FRM-002' });

addMovement({ id: 'MOV-014', holdingId: 'HLD-003', farmerId: 'FRM-003', productId: 'PST-004', type: 'OPENING_BALANCE', occurredAt: '2025-09-01', quantity: 25, unit: 'L', createdBy: 'U-FRM-003' });
addMovement({ id: 'MOV-015', holdingId: 'HLD-003', farmerId: 'FRM-003', productId: 'PST-006', type: 'OPENING_BALANCE', occurredAt: '2026-09-01', quantity: 10, unit: 'L', createdBy: 'U-FRM-003' });

addMovement({ id: 'MOV-016', holdingId: 'HLD-004', farmerId: 'FRM-004', productId: 'PST-003', type: 'OPENING_BALANCE', occurredAt: '2025-09-01', quantity: 25, unit: 'L', createdBy: 'U-FRM-004' });

addMovement({ id: 'MOV-017', holdingId: 'HLD-005', farmerId: 'FRM-005', productId: 'PST-001', type: 'OPENING_BALANCE', occurredAt: '2025-09-01', quantity: 40, unit: 'L', createdBy: 'U-FRM-005' });
addMovement({ id: 'MOV-018', holdingId: 'HLD-005', farmerId: 'FRM-005', productId: 'PST-001', type: 'RECEIPT', occurredAt: '2026-09-12', quantity: 10, unit: 'L', supplierOrReference: 'DEMO-SUPPLIER-03', createdBy: 'U-FRM-005' });
addMovement({ id: 'MOV-019', holdingId: 'HLD-005', farmerId: 'FRM-005', productId: 'PST-002', type: 'OPENING_BALANCE', occurredAt: '2026-09-01', quantity: 12, unit: 'kg', createdBy: 'U-FRM-005' });

interface TreatmentSeed {
  id: string;
  movementId: string;
  holdingId: string;
  farmerId: string;
  plotId: string;
  cropId: string;
  seasonId: string;
  date: string;
  productId: string;
  target: string;
  treatedAreaHa: number;
  totalCropAreaHa: number;
  appliedDose: number;
  quantity: number;
  createdAt: string;
  notes?: string;
}

const treatmentSeeds: TreatmentSeed[] = [
  { id: 'TRT-001', movementId: 'MOV-020', holdingId: 'HLD-001', farmerId: 'FRM-001', plotId: 'PLT-001', cropId: 'CRP-001', seasonId: 'SSN-2026', date: '2026-10-02', productId: 'PST-001', target: 'Fictional tomato leaf pest', treatedAreaHa: 4.5, totalCropAreaHa: 4.5, appliedDose: 0.8, quantity: 3.6, createdAt: at('2026-10-02', '09:10:00.000Z'), notes: 'Fictional demonstration treatment.' },
  { id: 'TRT-002', movementId: 'MOV-021', holdingId: 'HLD-001', farmerId: 'FRM-001', plotId: 'PLT-001', cropId: 'CRP-001', seasonId: 'SSN-2026', date: '2026-10-10', productId: 'PST-001', target: 'Fictional tomato leaf pest', treatedAreaHa: 4.5, totalCropAreaHa: 4.5, appliedDose: 0.75, quantity: 3.375, createdAt: at('2026-10-10', '08:50:00.000Z') },
  { id: 'TRT-003', movementId: 'MOV-022', holdingId: 'HLD-001', farmerId: 'FRM-001', plotId: 'PLT-002', cropId: 'CRP-003', seasonId: 'SSN-2026', date: '2026-10-05', productId: 'PST-003', target: 'Fictional scale insect', treatedAreaHa: 3.5, totalCropAreaHa: 3.5, appliedDose: 3, quantity: 10.5, createdAt: at('2026-10-05', '10:20:00.000Z') },
  { id: 'TRT-004', movementId: 'MOV-023', holdingId: 'HLD-001', farmerId: 'FRM-001', plotId: 'PLT-001', cropId: 'CRP-001', seasonId: 'SSN-2026', date: '2026-10-12', productId: 'PST-002', target: 'Fictional foliar disease', treatedAreaHa: 4.5, totalCropAreaHa: 4.5, appliedDose: 1.2, quantity: 5.4, createdAt: at('2026-10-12', '09:00:00.000Z') },
  { id: 'TRT-005', movementId: 'MOV-024', holdingId: 'HLD-002', farmerId: 'FRM-002', plotId: 'PLT-003', cropId: 'CRP-004', seasonId: 'SSN-2026', date: '2026-10-03', productId: 'PST-001', target: 'Fictional tomato leaf pest', treatedAreaHa: 7, totalCropAreaHa: 7, appliedDose: 0.8, quantity: 5.6, createdAt: at('2026-10-03', '08:45:00.000Z') },
  { id: 'TRT-006', movementId: 'MOV-025', holdingId: 'HLD-002', farmerId: 'FRM-002', plotId: 'PLT-003', cropId: 'CRP-004', seasonId: 'SSN-2026', date: '2026-10-08', productId: 'PST-002', target: 'Fictional foliar disease', treatedAreaHa: 7, totalCropAreaHa: 7, appliedDose: 1.2, quantity: 8.4, createdAt: at('2026-10-08', '10:10:00.000Z') },
  { id: 'TRT-007', movementId: 'MOV-026', holdingId: 'HLD-002', farmerId: 'FRM-002', plotId: 'PLT-004', cropId: 'CRP-005', seasonId: 'SSN-2026', date: '2026-10-14', productId: 'PST-005', target: 'Fictional fruit rot', treatedAreaHa: 5, totalCropAreaHa: 5, appliedDose: 2, quantity: 10, createdAt: at('2026-10-14', '11:30:00.000Z') },
  { id: 'TRT-008', movementId: 'MOV-027', holdingId: 'HLD-003', farmerId: 'FRM-003', plotId: 'PLT-005', cropId: 'CRP-006', seasonId: 'SSN-2026', date: '2026-10-06', productId: 'PST-004', target: 'Fictional grass weeds', treatedAreaHa: 6, totalCropAreaHa: 6, appliedDose: 2, quantity: 12, createdAt: at('2026-10-06', '09:30:00.000Z') },
  { id: 'TRT-009', movementId: 'MOV-028', holdingId: 'HLD-003', farmerId: 'FRM-003', plotId: 'PLT-005', cropId: 'CRP-006', seasonId: 'SSN-2026', date: '2026-10-15', productId: 'PST-006', target: 'Unverified demonstration target', treatedAreaHa: 6, totalCropAreaHa: 6, appliedDose: 0.5, quantity: 3, createdAt: at('2026-10-15', '08:20:00.000Z'), notes: 'This demonstration record intentionally has no verified reference dose.' },
  { id: 'TRT-010', movementId: 'MOV-029', holdingId: 'HLD-004', farmerId: 'FRM-004', plotId: 'PLT-006', cropId: 'CRP-007', seasonId: 'SSN-2026', date: '2026-10-07', productId: 'PST-003', target: 'Fictional scale insect', treatedAreaHa: 4.5, totalCropAreaHa: 4, appliedDose: 3, quantity: 13.5, createdAt: at('2026-10-07', '07:55:00.000Z'), notes: 'Demonstration record with an intentional total-area inconsistency.' },
  { id: 'TRT-011', movementId: 'MOV-030', holdingId: 'HLD-005', farmerId: 'FRM-005', plotId: 'PLT-007', cropId: 'CRP-008', seasonId: 'SSN-2026', date: '2026-10-09', productId: 'PST-001', target: 'Fictional maize pest', treatedAreaHa: 10, totalCropAreaHa: 10, appliedDose: 0.8, quantity: 8, createdAt: at('2026-10-09', '09:40:00.000Z') },
  { id: 'TRT-012', movementId: 'MOV-031', holdingId: 'HLD-005', farmerId: 'FRM-005', plotId: 'PLT-007', cropId: 'CRP-008', seasonId: 'SSN-2026', date: '2026-10-11', productId: 'PST-002', target: 'Fictional maize disease', treatedAreaHa: 10, totalCropAreaHa: 10, appliedDose: 1.2, quantity: 12, createdAt: at('2026-10-11', '10:00:00.000Z') },
  { id: 'TRT-H01', movementId: 'MOV-032', holdingId: 'HLD-001', farmerId: 'FRM-001', plotId: 'PLT-001', cropId: 'CRP-009', seasonId: 'SSN-2025', date: '2025-11-10', productId: 'PST-001', target: 'Fictional historical pest', treatedAreaHa: 5, totalCropAreaHa: 5, appliedDose: 0.4, quantity: 2, createdAt: at('2025-11-10', '09:00:00.000Z') },
  { id: 'TRT-H02', movementId: 'MOV-033', holdingId: 'HLD-001', farmerId: 'FRM-001', plotId: 'PLT-001', cropId: 'CRP-009', seasonId: 'SSN-2025', date: '2025-11-15', productId: 'PST-002', target: 'Fictional historical disease', treatedAreaHa: 5, totalCropAreaHa: 5, appliedDose: 0.4, quantity: 2, createdAt: at('2025-11-15', '09:00:00.000Z') },
  { id: 'TRT-H03', movementId: 'MOV-034', holdingId: 'HLD-002', farmerId: 'FRM-002', plotId: 'PLT-003', cropId: 'CRP-011', seasonId: 'SSN-2025', date: '2025-11-05', productId: 'PST-001', target: 'Fictional historical pest', treatedAreaHa: 7, totalCropAreaHa: 7, appliedDose: 0.428571, quantity: 3, createdAt: at('2025-11-05', '09:00:00.000Z') },
  { id: 'TRT-H04', movementId: 'MOV-035', holdingId: 'HLD-002', farmerId: 'FRM-002', plotId: 'PLT-003', cropId: 'CRP-011', seasonId: 'SSN-2025', date: '2025-11-12', productId: 'PST-002', target: 'Fictional historical disease', treatedAreaHa: 7, totalCropAreaHa: 7, appliedDose: 0.285714, quantity: 2, createdAt: at('2025-11-12', '09:00:00.000Z') },
  { id: 'TRT-H05', movementId: 'MOV-036', holdingId: 'HLD-003', farmerId: 'FRM-003', plotId: 'PLT-005', cropId: 'CRP-012', seasonId: 'SSN-2025', date: '2025-11-08', productId: 'PST-004', target: 'Fictional historical weeds', treatedAreaHa: 6, totalCropAreaHa: 6, appliedDose: 0.666667, quantity: 4, createdAt: at('2025-11-08', '09:00:00.000Z') },
  { id: 'TRT-H06', movementId: 'MOV-037', holdingId: 'HLD-004', farmerId: 'FRM-004', plotId: 'PLT-006', cropId: 'CRP-013', seasonId: 'SSN-2025', date: '2025-11-09', productId: 'PST-003', target: 'Fictional historical pest', treatedAreaHa: 4.5, totalCropAreaHa: 4.5, appliedDose: 0.888889, quantity: 4, createdAt: at('2025-11-09', '09:00:00.000Z') },
  { id: 'TRT-H07', movementId: 'MOV-038', holdingId: 'HLD-005', farmerId: 'FRM-005', plotId: 'PLT-007', cropId: 'CRP-014', seasonId: 'SSN-2025', date: '2025-11-07', productId: 'PST-001', target: 'Fictional historical pest', treatedAreaHa: 10, totalCropAreaHa: 10, appliedDose: 0.2, quantity: 2, createdAt: at('2025-11-07', '09:00:00.000Z') },
  { id: 'TRT-H08', movementId: 'MOV-039', holdingId: 'HLD-002', farmerId: 'FRM-002', plotId: 'PLT-003', cropId: 'CRP-015', seasonId: 'SSN-2024', date: '2025-03-10', productId: 'PST-001', target: 'Fictional historical pest', treatedAreaHa: 7, totalCropAreaHa: 7, appliedDose: 0.4, quantity: 2.8, createdAt: at('2025-03-10', '09:00:00.000Z') },
];

const treatments: TreatmentRecord[] = [];

for (const seed of treatmentSeeds) {
  const product = productMap.get(seed.productId);
  if (!product) throw new Error(`Missing product ${seed.productId}`);
  const referenceDoseStatus = product.referenceDose
    ? product.verificationStatus === 'VERIFIED'
      ? 'VERIFIED'
      : 'DEMO'
    : 'MISSING';
  addMovement({
    id: seed.movementId,
    holdingId: seed.holdingId,
    farmerId: seed.farmerId,
    productId: seed.productId,
    type: 'CONSUMPTION',
    occurredAt: seed.date,
    quantity: seed.quantity,
    unit: product.stockUnit,
    treatmentId: seed.id,
    notes: `Automatic consumption for treatment ${seed.id}`,
    createdBy: `U-FRM-${seed.farmerId.slice(-3)}`,
    createdAt: seed.createdAt,
  });
  treatments.push({
    id: seed.id,
    farmerId: seed.farmerId,
    holdingId: seed.holdingId,
    plotId: seed.plotId,
    cropId: seed.cropId,
    seasonId: seed.seasonId,
    treatmentDate: seed.date,
    productId: seed.productId,
    activeIngredientSnapshot: product.activeIngredient,
    target: seed.target,
    treatedAreaHa: seed.treatedAreaHa,
    totalCropAreaHa: seed.totalCropAreaHa,
    appliedDose: seed.appliedDose,
    appliedDoseUnit: (product.referenceDoseUnit ?? (product.stockUnit === 'L' ? 'L/ha' : product.stockUnit === 'kg' ? 'kg/ha' : product.stockUnit === 'mL' ? 'mL/ha' : 'g/ha')),
    referenceDose: product.referenceDose,
    referenceDoseUnit: product.referenceDoseUnit,
    referenceDoseStatus,
    referenceSource: product.referenceSource,
    quantityApplied: seed.quantity,
    quantityUnit: product.stockUnit,
    applicationMethod: seed.id.startsWith('TRT-H') ? 'Fictional historical application' : 'Demonstration knapsack sprayer',
    fieldConditions: 'Fictional demo conditions',
    notes: seed.notes,
    sourceInfo: 'Fictional local demonstration record',
    consumptionMovementId: seed.movementId,
    status: 'ACTIVE',
    revision: 1,
    createdAt: seed.createdAt,
    updatedAt: seed.createdAt,
    createdBy: `U-FRM-${seed.farmerId.slice(-3)}`,
  });
}

// Stock sanity check: never seed a negative running balance.
for (const holding of holdings) {
  for (const product of products) {
    const balance = currentStock(movements, holding.id, product.id, product.stockUnit);
    if (balance < -0.000001) {
      throw new Error(`Seed stock negative for ${holding.id}/${product.id}: ${balance}`);
    }
  }
}

const tfiConfig: TFIConfiguration = {
  id: 'tfi-config',
  version: 1,
  strategy: 'DOSE_RATIO_AREA_WEIGHTED',
  normalization: 'CROP_AREA',
  requireVerifiedDose: false,
  allowDemoReferenceDoses: true,
  updatedAt: STAMP,
  updatedBy: 'U-DSA-001',
  notes:
    'Provisional demonstration methodology (demo-1.0). Not an officially mandated Algerian TFI formula. Reference doses in this dataset are fictional. Configure only after institutional confirmation.',
};

const settings: ApplicationSettings = {
  id: 'settings',
  applicationName: 'El Oued Pesticide Management Platform',
  institution: 'DSA El Oued — local prototype',
  province: 'El Oued',
  wilaya: 'El Oued',
  defaultLanguage: 'en',
  lowStockThreshold: 10,
  allowSelfRegistration: true,
  demoMode: true,
  mapCenter: { lat: 33.3683, lng: 6.8674, zoom: 10 },
  communes: ['El Oued', 'Guemar', 'Debila', 'Reguiba', 'Robbah', 'Hassi Khelifa', 'Trifaoui', 'Magrane', 'Sidi Aoun', 'Douar El Ma'],
  cropCategories: ['Vegetables', 'Fodder', 'Cereals', 'Fruit trees', 'Industrial crops', 'Other'],
  cropSuggestions: ['Tomato', 'Potato', 'Onion', 'Date palm', 'Alfalfa', 'Maize', 'Melon', 'Pepper'],
  updatedAt: STAMP,
};

const auditEntries: Array<Omit<AuditEvent, 'id'>> = [
  { actorId: 'U-DSA-001', actorName: 'Amine Belhadj', role: 'DSA_ADMIN', action: 'DEMO_DATA_INITIALIZED', entityType: 'system', entityId: 'demo-seed', summary: 'Fictional demonstration dataset initialized.', timestamp: at('2026-09-01', '07:00:00.000Z') },
  { actorId: 'U-DSA-001', actorName: 'Amine Belhadj', role: 'DSA_ADMIN', action: 'FARMER_CREATED_BY_ADMIN', entityType: 'farmer', entityId: 'FRM-005', summary: 'Administrator created farmer Karim Zerguine and simulated an invitation.', timestamp: at('2025-09-07', '08:10:00.000Z'), metadata: { farmerId: 'FRM-005' } },
  { actorId: 'U-FRM-001', actorName: 'Youcef Benali', role: 'FARMER', action: 'INVENTORY_RECEIPT', entityType: 'inventoryMovement', entityId: 'MOV-003', summary: 'Receipt of 6 L recorded for Oasis Guard 250 EC (demo) at Oasis Benali.', timestamp: at('2026-09-10', '08:20:00.000Z'), metadata: { holdingId: 'HLD-001', productId: 'PST-001', quantity: 6, unit: 'L' } },
  { actorId: 'U-FRM-002', actorName: 'Amina Saadi', role: 'FARMER', action: 'INVENTORY_RECEIPT', entityType: 'inventoryMovement', entityId: 'MOV-008', summary: 'Receipt of 20 L recorded for Oasis Guard 250 EC (demo) at Palm Grove Saadi.', timestamp: at('2026-09-10', '08:30:00.000Z'), metadata: { holdingId: 'HLD-002', productId: 'PST-001', quantity: 20, unit: 'L' } },
  { actorId: 'U-FRM-001', actorName: 'Youcef Benali', role: 'FARMER', action: 'TREATMENT_CREATED', entityType: 'treatment', entityId: 'TRT-001', summary: 'Treatment recorded for Tomato at Oasis Benali using Oasis Guard 250 EC (demo).', timestamp: at('2026-10-02', '09:10:00.000Z'), metadata: { holdingId: 'HLD-001', cropId: 'CRP-001', productId: 'PST-001', quantity: 3.6, unit: 'L' } },
  { actorId: 'U-FRM-001', actorName: 'Youcef Benali', role: 'FARMER', action: 'TREATMENT_CREATED', entityType: 'treatment', entityId: 'TRT-003', summary: 'Treatment recorded for Date palm at Oasis Benali using Palm Care Oil 95 (demo).', timestamp: at('2026-10-05', '10:20:00.000Z'), metadata: { holdingId: 'HLD-001', cropId: 'CRP-003', productId: 'PST-003', quantity: 10.5, unit: 'L' } },
  { actorId: 'U-FRM-003', actorName: 'Brahim Haddadi', role: 'FARMER', action: 'TREATMENT_CREATED', entityType: 'treatment', entityId: 'TRT-009', summary: 'Treatment recorded with a missing reference dose for demonstration purposes.', timestamp: at('2026-10-15', '08:20:00.000Z'), metadata: { holdingId: 'HLD-003', cropId: 'CRP-006', productId: 'PST-006' } },
  { actorId: 'U-DSA-001', actorName: 'Amine Belhadj', role: 'DSA_ADMIN', action: 'TFI_CONFIGURATION_UPDATED', entityType: 'tfiConfiguration', entityId: 'tfi-config', summary: 'Provisional TFI demonstration configuration initialized at version 1.', timestamp: at('2026-10-01', '09:00:00.000Z'), metadata: { normalization: 'CROP_AREA' } },
  { actorId: 'U-DSA-001', actorName: 'Amine Belhadj', role: 'DSA_ADMIN', action: 'REPORT_GENERATED', entityType: 'report', entityId: 'tfi-by-crop-season', summary: 'Report "tfi-by-crop-season" generated with 8 row(s).', timestamp: at('2026-10-16', '12:15:00.000Z'), metadata: { reportType: 'tfi-by-crop-season', rowCount: 8 } },
  { actorId: 'U-CHM-001', actorName: 'Nadia Khelifi', role: 'CHAMBER_ADMIN', action: 'DEMO_SESSION_STARTED', entityType: 'user', entityId: 'U-CHM-001', summary: 'Demo session started as CHAMBER_ADMIN. This is a role simulation, not secure authentication.', timestamp: at('2026-10-17', '08:30:00.000Z'), metadata: { role: 'CHAMBER_ADMIN' } },
  { actorId: 'U-FRM-001', actorName: 'Youcef Benali', role: 'FARMER', action: 'DEMO_SESSION_STARTED', entityType: 'user', entityId: 'U-FRM-001', summary: 'Demo session started as FARMER. This is a role simulation, not secure authentication.', timestamp: at('2026-10-18', '08:40:00.000Z'), metadata: { role: 'FARMER' } },
  { actorId: 'U-DSA-001', actorName: 'Amine Belhadj', role: 'DSA_ADMIN', action: 'ALERT_REVIEWED', entityType: 'alert', entityId: 'LOW_STOCK:HLD-001:PST-001', summary: 'Low-stock alert reviewed during the demonstration walkthrough.', timestamp: at('2026-10-19', '10:25:00.000Z'), metadata: { category: 'LOW_STOCK' } },
];

const auditLog: AuditEvent[] = auditEntries.map((entry, index) => ({
  ...entry,
  id: `AUD-DEMO-${String(index + 1).padStart(3, '0')}`,
}));

const rawAlerts = deriveAlertCandidates({
  settings,
  farmers,
  holdings,
  products,
  movements,
  treatments,
  registrationRequests,
});
const alerts: Alert[] = mergeAlerts([], rawAlerts, STAMP).map((alert) =>
  alert.id === 'LOW_STOCK:HLD-001:PST-001' ? { ...alert, read: true } : alert,
);

const database: Database = {
  users,
  farmers,
  registrationRequests,
  holdings,
  plots,
  crops,
  seasons,
  pesticides: products,
  inventoryMovements: movements,
  treatments,
  alerts,
  auditLog,
  tfiConfig,
  settings,
};

async function writeJson(fileName: string, value: unknown): Promise<void> {
  await fs.writeFile(path.join(SEED_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  await fs.mkdir(SEED_DIR, { recursive: true });
  await Promise.all([
    writeJson('users.json', database.users),
    writeJson('farmers.json', database.farmers),
    writeJson('registration-requests.json', database.registrationRequests),
    writeJson('holdings.json', database.holdings),
    writeJson('plots.json', database.plots),
    writeJson('crops.json', database.crops),
    writeJson('seasons.json', database.seasons),
    writeJson('pesticides.json', database.pesticides),
    writeJson('inventory-movements.json', database.inventoryMovements),
    writeJson('treatments.json', database.treatments),
    writeJson('alerts.json', database.alerts),
    writeJson('audit-log.json', database.auditLog),
    writeJson('tfi-config.json', database.tfiConfig),
    writeJson('settings.json', database.settings),
  ]);
  console.info(
    `Wrote demo seed: ${farmers.length} farmers, ${holdings.length} holdings, ${crops.length} crops, ` +
      `${products.length} products, ${movements.length} movements, ${treatments.length} treatments, ${alerts.length} alerts.`,
  );
  console.info(`Seed directory: ${SEED_DIR}`);
  console.info('All records are fictional demonstration data.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
