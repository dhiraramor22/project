import type { ApplicationSettings, Database, TFIConfiguration } from '../../src/domain/types';

export const COLLECTION_FILES = {
  users: 'users.json',
  farmers: 'farmers.json',
  registrationRequests: 'registration-requests.json',
  holdings: 'holdings.json',
  plots: 'plots.json',
  crops: 'crops.json',
  seasons: 'seasons.json',
  pesticides: 'pesticides.json',
  inventoryMovements: 'inventory-movements.json',
  treatments: 'treatments.json',
  alerts: 'alerts.json',
  auditLog: 'audit-log.json',
  tfiConfig: 'tfi-config.json',
  settings: 'settings.json',
} as const;

export type FileKey = keyof typeof COLLECTION_FILES;
export const FILE_KEYS = Object.keys(COLLECTION_FILES) as FileKey[];

export const ARRAY_KEYS = [
  'users',
  'farmers',
  'registrationRequests',
  'holdings',
  'plots',
  'crops',
  'seasons',
  'pesticides',
  'inventoryMovements',
  'treatments',
  'alerts',
  'auditLog',
] as const satisfies readonly FileKey[];

export const DEFAULT_SETTINGS: ApplicationSettings = {
  id: 'settings',
  applicationName: 'El Oued Pesticide Management Platform',
  institution: 'DSA El Oued — prototype',
  province: 'El Oued',
  wilaya: 'El Oued',
  defaultLanguage: 'en',
  lowStockThreshold: 10,
  allowSelfRegistration: true,
  demoMode: true,
  mapCenter: { lat: 33.3683, lng: 6.8674, zoom: 10 },
  communes: [
    'El Oued',
    'Guemar',
    'Debila',
    'Reguiba',
    'Robbah',
    'Hassi Khelifa',
    'Trifaoui',
    'Magrane',
    'Sidi Aoun',
    'Douar El Ma',
  ],
  cropCategories: ['Vegetables', 'Fodder', 'Cereals', 'Fruit trees', 'Industrial crops', 'Other'],
  cropSuggestions: ['Tomato', 'Potato', 'Onion', 'Date palm', 'Alfalfa', 'Maize', 'Melon', 'Pepper'],
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_TFI_CONFIG: TFIConfiguration = {
  id: 'tfi-config',
  version: 1,
  strategy: 'DOSE_RATIO_AREA_WEIGHTED',
  normalization: 'CROP_AREA',
  requireVerifiedDose: false,
  allowDemoReferenceDoses: true,
  updatedAt: new Date().toISOString(),
  notes:
    'Provisional demonstration methodology. Not an officially mandated Algerian TFI formula. Configure only after institutional confirmation.',
};

export function createEmptyDatabase(): Database {
  return {
    users: [],
    farmers: [],
    registrationRequests: [],
    holdings: [],
    plots: [],
    crops: [],
    seasons: [],
    pesticides: [],
    inventoryMovements: [],
    treatments: [],
    alerts: [],
    auditLog: [],
    tfiConfig: { ...DEFAULT_TFI_CONFIG, updatedAt: new Date().toISOString() },
    settings: { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() },
  };
}

export function isValidCollectionShape(key: FileKey, value: unknown): boolean {
  if ((ARRAY_KEYS as readonly string[]).includes(key)) return Array.isArray(value);
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
