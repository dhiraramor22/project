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
import type { BootstrapPayload, DemoIdentity, PublicConfig, ReportResult, ReportType } from '../domain/api';
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
import { permissionsForRole } from '../domain/permissions';
import { isPreviewMode, getPreviewDisabledMessage } from '../config/preview';

// Import all seed data
import usersSeed from '../../data/demo-seed/users.json';
import farmersSeed from '../../data/demo-seed/farmers.json';
import registrationRequestsSeed from '../../data/demo-seed/registration-requests.json';
import holdingsSeed from '../../data/demo-seed/holdings.json';
import plotsSeed from '../../data/demo-seed/plots.json';
import cropsSeed from '../../data/demo-seed/crops.json';
import seasonsSeed from '../../data/demo-seed/seasons.json';
import pesticidesSeed from '../../data/demo-seed/pesticides.json';
import inventoryMovementsSeed from '../../data/demo-seed/inventory-movements.json';
import treatmentsSeed from '../../data/demo-seed/treatments.json';
import alertsSeed from '../../data/demo-seed/alerts.json';
import auditLogSeed from '../../data/demo-seed/audit-log.json';
import tfiConfigSeed from '../../data/demo-seed/tfi-config.json';
import settingsSeed from '../../data/demo-seed/settings.json';

// In-memory state for preview mode (resets on page refresh - not persisted)
let previewState = {
  users: JSON.parse(JSON.stringify(usersSeed)) as User[],
  farmers: JSON.parse(JSON.stringify(farmersSeed)) as FarmerProfile[],
  registrationRequests: JSON.parse(JSON.stringify(registrationRequestsSeed)) as RegistrationRequest[],
  holdings: JSON.parse(JSON.stringify(holdingsSeed)) as AgriculturalHolding[],
  plots: JSON.parse(JSON.stringify(plotsSeed)) as Plot[],
  crops: JSON.parse(JSON.stringify(cropsSeed)) as CropRecord[],
  seasons: JSON.parse(JSON.stringify(seasonsSeed)) as any[],
  pesticides: JSON.parse(JSON.stringify(pesticidesSeed)) as PesticideProduct[],
  inventoryMovements: JSON.parse(JSON.stringify(inventoryMovementsSeed)) as InventoryMovement[],
  treatments: JSON.parse(JSON.stringify(treatmentsSeed)) as TreatmentRecord[],
  alerts: JSON.parse(JSON.stringify(alertsSeed)) as Alert[],
  auditLog: JSON.parse(JSON.stringify(auditLogSeed)) as any[],
  tfiConfig: JSON.parse(JSON.stringify(tfiConfigSeed)) as TFIConfiguration,
  settings: JSON.parse(JSON.stringify(settingsSeed)) as ApplicationSettings,
};

function buildPublicConfig(): PublicConfig {
  const demoUsers: DemoIdentity[] = previewState.users
    .filter((user) => user.demo && user.status !== 'SUSPENDED')
    .map((user) => ({
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      farmerId: user.farmerId,
      scopeCommunes: user.scopeCommunes,
      permissions: permissionsForRole(user.role),
    }));

  return {
    applicationName: previewState.settings.applicationName,
    institution: previewState.settings.institution,
    province: previewState.settings.province,
    wilaya: previewState.settings.wilaya,
    defaultLanguage: previewState.settings.defaultLanguage,
    allowSelfRegistration: previewState.settings.allowSelfRegistration,
    demoMode: true, // Always true in preview
    communes: previewState.settings.communes,
    cropSuggestions: previewState.settings.cropSuggestions,
    cropCategories: previewState.settings.cropCategories,
    demoUsers,
  };
}

export const mockRepository: WorkspaceRepository = {
  getPublicConfig: async () => {
    return buildPublicConfig();
  },

  startDemoSession: async (userId: string): Promise<DemoSessionResult> => {
    const user = previewState.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('Demo user was not found.');
    }
    if (!user.demo) {
      throw new Error('Only demo identities can be selected without credentials.');
    }
    if (user.status === 'SUSPENDED') {
      throw new Error('This demo account is suspended.');
    }
    return {
      user,
      role: user.role,
      permissions: permissionsForRole(user.role),
      notice: 'DEMO PREVIEW MODE - Simulated session only. Not secure authentication. No data persistence.',
    };
  },

  getBootstrap: async (): Promise<BootstrapPayload> => {
    // In preview, we need to know which user - but getBootstrap is called after login
    // We'll try to get from localStorage
    let currentUser: User | undefined;
    if (typeof window !== 'undefined') {
      try {
        const session = localStorage.getItem('eloued.session');
        if (session) {
          const parsed = JSON.parse(session);
          currentUser = previewState.users.find((u) => u.id === parsed.userId);
        }
      } catch {}
    }
    
    if (!currentUser) {
      // Default to first demo admin for preview
      currentUser = previewState.users.find((u) => u.demo && u.role === 'DSA_ADMIN') || previewState.users[0];
    }

    const demoUsers: DemoIdentity[] = previewState.users
      .filter((user) => user.demo && user.status !== 'SUSPENDED')
      .map((user) => ({
        id: user.id,
        fullName: user.fullName,
        role: user.role,
        farmerId: user.farmerId,
        scopeCommunes: user.scopeCommunes,
        permissions: permissionsForRole(user.role),
      }));

    return {
      user: currentUser,
      role: currentUser.role,
      permissions: permissionsForRole(currentUser.role),
      farmerId: currentUser.farmerId,
      scopeCommunes: currentUser.scopeCommunes,
      settings: previewState.settings,
      tfiConfig: previewState.tfiConfig,
      users: previewState.users,
      demoUsers,
      farmers: previewState.farmers,
      holdings: previewState.holdings,
      plots: previewState.plots,
      crops: previewState.crops,
      seasons: previewState.seasons,
      pesticides: previewState.pesticides,
      inventoryMovements: previewState.inventoryMovements,
      treatments: previewState.treatments,
      alerts: previewState.alerts,
      registrationRequests: previewState.registrationRequests,
      auditLog: previewState.auditLog,
      generatedAt: new Date().toISOString(),
    };
  },

  // Registration
  submitRegistration: async () => {
    throw new Error(getPreviewDisabledMessage());
  },
  createFarmer: async () => {
    throw new Error(getPreviewDisabledMessage());
  },

  // Farmer management - simulate in memory but warn
  updateFarmer: async (id, input) => {
    console.warn('[PREVIEW MODE]', getPreviewDisabledMessage());
    const farmer = previewState.farmers.find((f) => f.id === id);
    if (!farmer) throw new Error('Farmer not found');
    Object.assign(farmer, input, { updatedAt: new Date().toISOString() });
    return { ...farmer };
  },
  updateOwnFarmer: async (input) => {
    console.warn('[PREVIEW MODE]', getPreviewDisabledMessage());
    throw new Error(getPreviewDisabledMessage());
  },
  suspendFarmer: async () => { throw new Error(getPreviewDisabledMessage()); },
  reactivateFarmer: async () => { throw new Error(getPreviewDisabledMessage()); },
  approveRegistration: async () => { throw new Error(getPreviewDisabledMessage()); },
  rejectRegistration: async () => { throw new Error(getPreviewDisabledMessage()); },

  // Holdings
  createHolding: async () => { throw new Error(getPreviewDisabledMessage()); },
  updateHolding: async () => { throw new Error(getPreviewDisabledMessage()); },
  createPlot: async () => { throw new Error(getPreviewDisabledMessage()); },
  updatePlot: async () => { throw new Error(getPreviewDisabledMessage()); },
  createCrop: async () => { throw new Error(getPreviewDisabledMessage()); },
  updateCrop: async () => { throw new Error(getPreviewDisabledMessage()); },
  deleteCrop: async () => { throw new Error(getPreviewDisabledMessage()); },
  createSeason: async () => { throw new Error(getPreviewDisabledMessage()); },
  updateSeason: async () => { throw new Error(getPreviewDisabledMessage()); },

  // Products
  createProduct: async () => { throw new Error(getPreviewDisabledMessage()); },
  updateProduct: async () => { throw new Error(getPreviewDisabledMessage()); },
  setProductArchived: async () => { throw new Error(getPreviewDisabledMessage()); },

  // Inventory
  createMovement: async () => { throw new Error(getPreviewDisabledMessage()); },
  reverseMovement: async () => { throw new Error(getPreviewDisabledMessage()); },

  // Treatments
  createTreatment: async () => { throw new Error(getPreviewDisabledMessage()); },
  updateTreatment: async () => { throw new Error(getPreviewDisabledMessage()); },
  reverseTreatment: async () => { throw new Error(getPreviewDisabledMessage()); },

  // TFI
  calculateTfi: async () => {
    throw new Error(getPreviewDisabledMessage());
  },
  updateTfiConfig: async () => { throw new Error(getPreviewDisabledMessage()); },

  // Alerts
  markAlertRead: async (id) => {
    const alert = previewState.alerts.find((a) => a.id === id);
    if (alert) alert.read = true;
    return { alert: alert! };
  },
  markAllAlertsRead: async () => {
    let count = 0;
    previewState.alerts.forEach((a) => {
      if (!a.read) { a.read = true; count++; }
    });
    return { updated: count };
  },
  resolveAlert: async () => { throw new Error(getPreviewDisabledMessage()); },

  // Reports - return mock report
  generateReport: async (type: ReportType, filters: ReportFilters): Promise<ReportResult> => {
    return {
      reportType: type,
      titleKey: `reports.${type}`,
      descriptionKey: 'reports.previewDescription',
      columns: [],
      rows: [],
      rowCount: 0,
      generatedAt: new Date().toISOString(),
      filters: filters as Record<string, string | undefined>,
      demoData: true,
    };
  },

  // Settings
  updateSettings: async () => { throw new Error(getPreviewDisabledMessage()); },

  // Admin
  listBackups: async () => ({ backups: [] }),
  downloadBackup: async () => {
    throw new Error(getPreviewDisabledMessage());
  },
  importBackup: async () => {
    throw new Error(getPreviewDisabledMessage());
  },
  resetDemo: async () => {
    throw new Error(getPreviewDisabledMessage());
  },
};
