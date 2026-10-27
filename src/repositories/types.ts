import type {
  BootstrapPayload,
  DemoIdentity,
  PublicConfig,
  ReportResult,
  ReportType,
} from '../domain/api';
import type {
  CropInput,
  FarmerAdminInput,
  FarmerSelfInput,
  HoldingInput,
  MovementInput,
  PlotInput,
  ProductInput,
  RegistrationInput,
  SettingsInput,
  TFIConfigInput,
  TreatmentInput,
} from '../domain/schemas';
import type {
  Alert,
  ApplicationSettings,
  CropRecord,
  FarmerProfile,
  AgriculturalHolding,
  InventoryMovement,
  PesticideProduct,
  Plot,
  RegistrationRequest,
  Role,
  TFICalculationResult,
  TFIConfiguration,
  TreatmentRecord,
  User,
} from '../domain/types';

export interface DemoSessionResult {
  user: User;
  role: Role;
  permissions: string[];
  notice: string;
}

export interface PublicRegistrationResult {
  farmerId: string;
  requestId: string;
  status: string;
  submittedAt: string;
  message: string;
}

export interface FarmerCreationResult {
  farmer: FarmerProfile;
  request: RegistrationRequest;
  user: User;
}

export interface AreaWarningResult<T> {
  warnings: string[];
  holding?: T;
  plot?: T;
  crop?: T;
}

export interface TreatmentResult {
  treatment: TreatmentRecord;
  warnings: string[];
}

export interface MovementResult {
  movement: InventoryMovement;
  warnings: string[];
}

export interface BackupSummary {
  fileName: string;
  createdAt: string;
  bytes: number;
}

export interface BackupImportResult {
  imported: boolean;
  preImportBackup: string;
  message: string;
}

export interface DemoResetResult {
  reset: boolean;
  preResetBackup: string;
  message: string;
}

export interface ReportFilters {
  seasonId?: string;
  cropId?: string;
  holdingId?: string;
  productId?: string;
  from?: string;
  to?: string;
  status?: string;
}

/**
 * The application talks to the local JSON service through this contract.
 * A different adapter (for example, an in-memory demo adapter) can replace it
 * without changing pages or providers.
 */
export interface WorkspaceRepository {
  getPublicConfig(): Promise<PublicConfig>;
  startDemoSession(userId: string): Promise<DemoSessionResult>;
  getBootstrap(): Promise<BootstrapPayload>;

  submitRegistration(input: RegistrationInput): Promise<PublicRegistrationResult>;
  createFarmer(input: RegistrationInput): Promise<FarmerCreationResult>;
  updateFarmer(id: string, input: FarmerAdminInput): Promise<FarmerProfile>;
  updateOwnFarmer(input: FarmerSelfInput): Promise<FarmerProfile>;
  suspendFarmer(id: string): Promise<FarmerProfile>;
  reactivateFarmer(id: string): Promise<FarmerProfile>;
  approveRegistration(id: string, notes?: string): Promise<FarmerProfile>;
  rejectRegistration(id: string, notes?: string): Promise<FarmerProfile>;

  createHolding(input: HoldingInput): Promise<{ holding: AgriculturalHolding; warnings: string[] }>;
  updateHolding(id: string, input: HoldingInput): Promise<{ holding: AgriculturalHolding; warnings: string[] }>;
  createPlot(input: PlotInput & { holdingId: string }): Promise<{ plot: Plot; warnings: string[] }>;
  updatePlot(id: string, input: PlotInput): Promise<{ plot: Plot; warnings: string[] }>;
  createCrop(input: CropInput): Promise<{ crop: CropRecord; warnings: string[] }>;
  updateCrop(id: string, input: CropInput): Promise<{ crop: CropRecord; warnings: string[] }>;
  deleteCrop(id: string): Promise<{ deleted: boolean }>;
  createSeason(input: {
    label: string;
    startDate: string;
    endDate: string;
    status: 'ACTIVE' | 'CLOSED';
  }): Promise<{ season: import('../domain/types').AgriculturalSeason }>;
  updateSeason(
    id: string,
    input: {
      label: string;
      startDate: string;
      endDate: string;
      status: 'ACTIVE' | 'CLOSED';
    },
  ): Promise<{ season: import('../domain/types').AgriculturalSeason }>;

  createProduct(input: ProductInput): Promise<{ product: PesticideProduct }>;
  updateProduct(id: string, input: ProductInput): Promise<{ product: PesticideProduct }>;
  setProductArchived(id: string, archived: boolean): Promise<{ product: PesticideProduct }>;

  createMovement(input: MovementInput): Promise<MovementResult>;
  reverseMovement(id: string, reason: string): Promise<{ movement: InventoryMovement }>;

  createTreatment(input: TreatmentInput): Promise<TreatmentResult>;
  updateTreatment(id: string, input: TreatmentInput): Promise<TreatmentResult>;
  reverseTreatment(id: string, reason: string): Promise<{ treatment: TreatmentRecord }>;

  calculateTfi(input: {
    scopeType: string;
    scopeId?: string;
    seasonId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ result: TFICalculationResult }>;
  updateTfiConfig(input: TFIConfigInput): Promise<{ config: TFIConfiguration }>;

  markAlertRead(id: string): Promise<{ alert: Alert }>;
  markAllAlertsRead(): Promise<{ updated: number }>;
  resolveAlert(id: string, notes?: string): Promise<{ alert: Alert }>;

  generateReport(type: ReportType, filters: ReportFilters): Promise<ReportResult>;

  updateSettings(input: SettingsInput): Promise<{ settings: ApplicationSettings }>;

  listBackups(): Promise<{ backups: BackupSummary[] }>;
  downloadBackup(): Promise<{ blob: Blob; fileName: string }>;
  importBackup(backup: unknown): Promise<BackupImportResult>;
  resetDemo(): Promise<DemoResetResult>;

  demoIdentities?(): DemoIdentity[];
}
