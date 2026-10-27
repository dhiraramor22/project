export type Language = 'en' | 'fr' | 'ar';

export type Role = 'DSA_ADMIN' | 'CHAMBER_ADMIN' | 'FARMER';

export type Permission =
  | 'dashboard:view'
  | 'registration:submit'
  | 'registration:review'
  | 'farmer:read'
  | 'farmer:create'
  | 'farmer:manage'
  | 'farmer:suspend'
  | 'farmer:self:manage'
  | 'holding:read'
  | 'holding:write'
  | 'catalogue:read'
  | 'catalogue:manage'
  | 'inventory:read'
  | 'inventory:write'
  | 'treatment:read'
  | 'treatment:write'
  | 'treatment:reverse'
  | 'tfi:read'
  | 'alert:read'
  | 'report:export'
  | 'audit:view'
  | 'map:view'
  | 'settings:manage'
  | 'backup:manage';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INVITED';

export type FarmerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type HoldingStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type VerificationStatus = 'VERIFIED' | 'DEMO' | 'UNVERIFIED';

export type StockUnit = 'L' | 'mL' | 'kg' | 'g';

export type DoseUnit = 'L/ha' | 'mL/ha' | 'kg/ha' | 'g/ha';

export type MovementType =
  | 'OPENING_BALANCE'
  | 'RECEIPT'
  | 'CONSUMPTION'
  | 'ADJUSTMENT'
  | 'RETURN';

export type MovementStatus = 'ACTIVE' | 'REVERSED';

export type TreatmentStatus = 'ACTIVE' | 'REVERSED';

export type AlertCategory =
  | 'LOW_STOCK'
  | 'PENDING_REGISTRATION'
  | 'INCOMPLETE_TREATMENT'
  | 'UNVERIFIED_REFERENCE_DOSE'
  | 'AREA_MISMATCH'
  | 'INSUFFICIENT_STOCK';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type TFIScopeType = 'TREATMENT' | 'CROP' | 'PLOT' | 'HOLDING' | 'SEASON' | 'ALL';

export type TFINormalization = 'CROP_AREA' | 'TREATED_AREA';

export interface User {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  phone?: string;
  preferredLanguage: Language;
  farmerId?: string;
  /** Undefined means every commune in the province (DSA only). */
  scopeCommunes?: string[];
  status: UserStatus;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FarmerProfile {
  id: string;
  userId?: string;
  fullName: string;
  email: string;
  phone: string;
  preferredLanguage: Language;
  commune: string;
  agriculturalId?: string;
  supportingInfo?: string;
  proposedHoldingName?: string;
  proposedAreaHa?: number;
  mainCrops?: string[];
  status: FarmerStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  suspendedAt?: string;
  notes?: string;
}

export interface RegistrationRequest {
  id: string;
  farmerId: string;
  submittedAt: string;
  status: RegistrationStatus;
  source: 'SELF' | 'ADMIN';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface AgriculturalHolding {
  id: string;
  name: string;
  ownerFarmerId: string;
  wilaya: string;
  commune: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  totalCultivatedAreaHa: number;
  status: HoldingStatus;
  coordinatesAreDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Plot {
  id: string;
  holdingId: string;
  name: string;
  areaHa: number;
  soilType?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CropRecord {
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
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgriculturalSeason {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'CLOSED';
}

export interface PesticideProduct {
  id: string;
  commercialName: string;
  activeIngredient: string;
  category: string;
  formulation: string;
  manufacturer: string;
  registrationReference?: string;
  intendedCrops: string[];
  targetPests: string[];
  referenceDose?: number;
  referenceDoseUnit?: DoseUnit;
  referenceSource?: string;
  safetyInfo: string;
  preHarvestIntervalDays?: number;
  reEntryIntervalHours?: number;
  stockUnit: StockUnit;
  lowStockThreshold: number;
  verificationStatus: VerificationStatus;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  holdingId: string;
  farmerId: string;
  productId: string;
  type: MovementType;
  occurredAt: string;
  quantity: number;
  unit: StockUnit;
  adjustmentDirection?: 'IN' | 'OUT';
  supplierOrReference?: string;
  treatmentId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  status: MovementStatus;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  relatedMovementId?: string;
}

export type ReferenceDoseStatus = 'VERIFIED' | 'DEMO' | 'MISSING';

export interface TreatmentRecord {
  id: string;
  farmerId: string;
  holdingId: string;
  plotId: string;
  cropId: string;
  seasonId: string;
  treatmentDate: string;
  productId: string;
  activeIngredientSnapshot: string;
  target: string;
  treatedAreaHa: number;
  totalCropAreaHa: number;
  appliedDose: number;
  appliedDoseUnit: DoseUnit;
  referenceDose?: number;
  referenceDoseUnit?: DoseUnit;
  referenceDoseStatus: ReferenceDoseStatus;
  referenceSource?: string;
  quantityApplied: number;
  quantityUnit: StockUnit;
  applicationMethod?: string;
  fieldConditions?: string;
  notes?: string;
  sourceInfo?: string;
  consumptionMovementId?: string;
  status: TreatmentStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
}

export interface TFIConfiguration {
  id: string;
  version: number;
  strategy: 'DOSE_RATIO_AREA_WEIGHTED';
  normalization: TFINormalization;
  requireVerifiedDose: boolean;
  allowDemoReferenceDoses: boolean;
  updatedAt: string;
  updatedBy?: string;
  notes?: string;
}

export interface TFITreatmentContribution {
  treatmentId: string;
  cropId: string;
  plotId: string;
  holdingId: string;
  productId: string;
  treatedAreaHa: number;
  doseRatio: number;
  weightedIndex: number;
  referenceDoseStatus: ReferenceDoseStatus;
  referenceDose: number;
  referenceDoseUnit: DoseUnit;
  appliedDose: number;
  appliedDoseUnit: DoseUnit;
}

export interface TFIExclusion {
  treatmentId: string;
  reason:
    | 'MISSING_REFERENCE_DOSE'
    | 'INCOMPATIBLE_DOSE_UNITS'
    | 'INVALID_REFERENCE_DOSE'
    | 'INVALID_DOSE'
    | 'INVALID_AREA'
    | 'UNVERIFIED_REFERENCE_DOSE'
    | 'DUPLICATE_TREATMENT';
  detail?: string;
}

export interface TFICalculationResult {
  scopeType: TFIScopeType;
  scopeId?: string;
  seasonId?: string;
  dateFrom?: string;
  dateTo?: string;
  value: number | null;
  status: 'OK' | 'INCOMPLETE' | 'EMPTY';
  includedTreatments: TFITreatmentContribution[];
  excludedTreatments: TFIExclusion[];
  denominatorAreaHa: number;
  treatmentCount: number;
  configuration: Pick<
    TFIConfiguration,
    'version' | 'strategy' | 'normalization' | 'requireVerifiedDose' | 'allowDemoReferenceDoses'
  >;
  methodologyVersion: string;
  calculatedAt: string;
  provisional: true;
}

export interface Alert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  farmerId?: string;
  holdingId?: string;
  entityType: string;
  entityId: string;
  titleKey: string;
  data?: Record<string, string | number>;
  createdAt: string;
  updatedAt: string;
  read: boolean;
  resolved: boolean;
  resolvedAt?: string;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  actorName: string;
  role: Role;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
  timestamp: string;
}

export interface ApplicationSettings {
  id: string;
  applicationName: string;
  institution: string;
  province: string;
  wilaya: string;
  defaultLanguage: Language;
  lowStockThreshold: number;
  allowSelfRegistration: boolean;
  demoMode: boolean;
  mapCenter: { lat: number; lng: number; zoom: number };
  communes: string[];
  cropCategories: string[];
  cropSuggestions: string[];
  lastResetAt?: string;
  updatedAt: string;
}

export interface Database {
  users: User[];
  farmers: FarmerProfile[];
  registrationRequests: RegistrationRequest[];
  holdings: AgriculturalHolding[];
  plots: Plot[];
  crops: CropRecord[];
  seasons: AgriculturalSeason[];
  pesticides: PesticideProduct[];
  inventoryMovements: InventoryMovement[];
  treatments: TreatmentRecord[];
  alerts: Alert[];
  auditLog: AuditEvent[];
  tfiConfig: TFIConfiguration;
  settings: ApplicationSettings;
}

export type CollectionName = Exclude<keyof Database, 'tfiConfig' | 'settings'>;

export interface AuthContext {
  user: User;
  role: Role;
  permissions: Permission[];
  farmerId?: string;
  scopeCommunes?: string[];
}

export interface AccessScope {
  role: Role;
  userId: string;
  farmerId?: string;
  scopeCommunes?: string[];
}
