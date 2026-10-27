import type { PublicConfig, ReportResult, ReportType } from '../domain/api';
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
  TFICalculationResult,
  TFIConfiguration,
  TreatmentRecord,
} from '../domain/types';
import { apiClient } from '../services/apiClient';
import type {
  BackupImportResult,
  BackupSummary,
  DemoResetResult,
  DemoSessionResult,
  FarmerCreationResult,
  MovementResult,
  PublicRegistrationResult,
  ReportFilters,
  TreatmentResult,
  WorkspaceRepository,
} from './types';

export const httpRepository: WorkspaceRepository = {
  getPublicConfig: () => apiClient.get<PublicConfig>('/public-config'),

  startDemoSession: (userId) => apiClient.post<DemoSessionResult>('/session/demo', { userId }),

  getBootstrap: () =>
    apiClient.get<import('../domain/api').BootstrapPayload>('/bootstrap'),

  submitRegistration: (input: RegistrationInput) =>
    apiClient.post<PublicRegistrationResult>('/registrations/public', input),

  createFarmer: (input: RegistrationInput) =>
    apiClient.post<FarmerCreationResult>('/farmers', input),

  updateFarmer: async (id, input: FarmerAdminInput) => {
    const result = await apiClient.put<{ farmer: FarmerProfile }>(`/farmers/${id}`, input);
    return result.farmer;
  },

  updateOwnFarmer: async (input: FarmerSelfInput) => {
    const result = await apiClient.put<{ farmer: FarmerProfile }>('/farmers/me', input);
    return result.farmer;
  },

  suspendFarmer: async (id) => {
    const result = await apiClient.post<{ farmer: FarmerProfile }>(`/farmers/${id}/suspend`, {});
    return result.farmer;
  },

  reactivateFarmer: async (id) => {
    const result = await apiClient.post<{ farmer: FarmerProfile }>(`/farmers/${id}/reactivate`, {});
    return result.farmer;
  },

  approveRegistration: async (id, notes) => {
    const result = await apiClient.post<{ farmer: FarmerProfile }>(
      `/registrations/${id}/approve`,
      { notes },
    );
    return result.farmer;
  },

  rejectRegistration: async (id, notes) => {
    const result = await apiClient.post<{ farmer: FarmerProfile }>(
      `/registrations/${id}/reject`,
      { notes },
    );
    return result.farmer;
  },

  createHolding: (input) =>
    apiClient.post<{ holding: AgriculturalHolding; warnings: string[] }>('/holdings', input),

  updateHolding: (id, input) =>
    apiClient.put<{ holding: AgriculturalHolding; warnings: string[] }>(`/holdings/${id}`, input),

  createPlot: (input) =>
    apiClient.post<{ plot: Plot; warnings: string[] }>('/plots', input),

  updatePlot: (id, input) =>
    apiClient.put<{ plot: Plot; warnings: string[] }>(`/plots/${id}`, input),

  createCrop: (input) =>
    apiClient.post<{ crop: CropRecord; warnings: string[] }>('/crops', input),

  updateCrop: (id, input) =>
    apiClient.put<{ crop: CropRecord; warnings: string[] }>(`/crops/${id}`, input),

  deleteCrop: (id) => apiClient.delete<{ deleted: boolean }>(`/crops/${id}`),

  createSeason: (input) =>
    apiClient.post<{ season: import('../domain/types').AgriculturalSeason }>('/seasons', input),

  updateSeason: (id, input) =>
    apiClient.put<{ season: import('../domain/types').AgriculturalSeason }>(`/seasons/${id}`, input),

  createProduct: (input) =>
    apiClient.post<{ product: PesticideProduct }>('/pesticides', input),

  updateProduct: (id, input) =>
    apiClient.put<{ product: PesticideProduct }>(`/pesticides/${id}`, input),

  setProductArchived: (id, archived) =>
    apiClient.post<{ product: PesticideProduct }>(`/pesticides/${id}/archive`, { archived }),

  createMovement: (input: MovementInput) =>
    apiClient.post<MovementResult>('/inventory-movements', input),

  reverseMovement: (id, reason) =>
    apiClient.post<{ movement: InventoryMovement }>(`/inventory-movements/${id}/reverse`, { reason }),

  createTreatment: (input: TreatmentInput) =>
    apiClient.post<TreatmentResult>('/treatments', input),

  updateTreatment: (id, input) =>
    apiClient.put<TreatmentResult>(`/treatments/${id}`, input),

  reverseTreatment: (id, reason) =>
    apiClient.post<{ treatment: TreatmentRecord }>(`/treatments/${id}/reverse`, { reason }),

  calculateTfi: (input) =>
    apiClient.post<{ result: TFICalculationResult }>('/tfi/calculate', input),

  updateTfiConfig: (input: TFIConfigInput) =>
    apiClient.put<{ config: TFIConfiguration }>('/tfi/config', input),

  markAlertRead: (id) => apiClient.post<{ alert: Alert }>(`/alerts/${id}/read`, {}),

  markAllAlertsRead: () => apiClient.post<{ updated: number }>('/alerts/read-all', {}),

  resolveAlert: (id, notes) =>
    apiClient.post<{ alert: Alert }>(`/alerts/${id}/resolve`, { notes }),

  generateReport: (type: ReportType, filters: ReportFilters) =>
    apiClient.get<ReportResult>(`/reports/${type}`, { ...filters }),

  updateSettings: (input: SettingsInput) =>
    apiClient.put<{ settings: ApplicationSettings }>('/settings', input),

  listBackups: () => apiClient.get<{ backups: BackupSummary[] }>('/admin/backups'),

  downloadBackup: () => apiClient.download('/admin/backup'),

  importBackup: (backup) =>
    apiClient.post<BackupImportResult>('/admin/backup/import', {
      confirm: 'IMPORT_BACKUP',
      backup,
    }),

  resetDemo: () => apiClient.post<DemoResetResult>('/admin/reset-demo', { confirm: 'RESET_DEMO' }),
};
