import type {
  Alert,
  ApplicationSettings,
  AuditEvent,
  AuthContext,
  FarmerProfile,
  AgriculturalHolding,
  InventoryMovement,
  PesticideProduct,
  Plot,
  RegistrationRequest,
  TFIConfiguration,
  TreatmentRecord,
  User,
} from './types';

export interface DemoIdentity {
  id: string;
  fullName: string;
  role: AuthContext['role'];
  farmerId?: string;
  scopeCommunes?: string[];
  permissions: string[];
}

export interface PublicConfig {
  applicationName: string;
  institution: string;
  province: string;
  wilaya: string;
  defaultLanguage: 'en' | 'fr' | 'ar';
  allowSelfRegistration: boolean;
  demoMode: boolean;
  communes: string[];
  cropSuggestions: string[];
  cropCategories: string[];
  demoUsers: DemoIdentity[];
}

export interface BootstrapPayload {
  user: User;
  role: AuthContext['role'];
  permissions: string[];
  farmerId?: string;
  scopeCommunes?: string[];
  settings: ApplicationSettings;
  tfiConfig: TFIConfiguration;
  users: User[];
  demoUsers: DemoIdentity[];
  farmers: FarmerProfile[];
  holdings: AgriculturalHolding[];
  plots: Plot[];
  crops: import('./types').CropRecord[];
  seasons: import('./types').AgriculturalSeason[];
  pesticides: PesticideProduct[];
  inventoryMovements: InventoryMovement[];
  treatments: TreatmentRecord[];
  alerts: Alert[];
  registrationRequests: RegistrationRequest[];
  auditLog: AuditEvent[];
  generatedAt: string;
}

export type ReportType =
  | 'inventory-balances'
  | 'inventory-movements'
  | 'treatments'
  | 'treatments-by-crop'
  | 'treatments-by-product'
  | 'tfi-by-crop-season'
  | 'farmers'
  | 'holdings'
  | 'registrations'
  | 'low-stock-alerts'
  | 'audit-logs';

export interface ReportColumn {
  key: string;
  labelKey: string;
}

export interface ReportResult {
  reportType: ReportType;
  titleKey: string;
  descriptionKey: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  rowCount: number;
  generatedAt: string;
  filters: Record<string, string | undefined>;
  demoData: true;
}

export const REPORT_TYPES: ReportType[] = [
  'inventory-balances',
  'inventory-movements',
  'treatments',
  'treatments-by-crop',
  'treatments-by-product',
  'tfi-by-crop-season',
  'farmers',
  'holdings',
  'registrations',
  'low-stock-alerts',
  'audit-logs',
];

export const REPORT_ALLOWED_ROLES: Record<ReportType, AuthContext['role'][]> = {
  'inventory-balances': ['DSA_ADMIN', 'CHAMBER_ADMIN', 'FARMER'],
  'inventory-movements': ['DSA_ADMIN', 'CHAMBER_ADMIN', 'FARMER'],
  treatments: ['DSA_ADMIN', 'CHAMBER_ADMIN', 'FARMER'],
  'treatments-by-crop': ['DSA_ADMIN', 'CHAMBER_ADMIN', 'FARMER'],
  'treatments-by-product': ['DSA_ADMIN', 'CHAMBER_ADMIN', 'FARMER'],
  'tfi-by-crop-season': ['DSA_ADMIN', 'CHAMBER_ADMIN', 'FARMER'],
  farmers: ['DSA_ADMIN', 'CHAMBER_ADMIN'],
  holdings: ['DSA_ADMIN', 'CHAMBER_ADMIN', 'FARMER'],
  registrations: ['DSA_ADMIN'],
  'low-stock-alerts': ['DSA_ADMIN', 'CHAMBER_ADMIN', 'FARMER'],
  'audit-logs': ['DSA_ADMIN'],
};
