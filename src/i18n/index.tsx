import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Language } from '../domain/types';
import { ar } from './ar';
import { en, type TranslationKey } from './en';
import { fr } from './fr';

export type { TranslationKey };

const STORAGE_KEY = 'eloued.language';

const DICTIONARIES: Record<Language, Partial<Record<TranslationKey, string>>> = {
  en,
  fr,
  ar,
};

export const RTL_LANGUAGES: Language[] = ['ar'];
export const SUPPORTED_LANGUAGES: Language[] = ['en', 'fr', 'ar'];

export function dirFor(language: Language): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.includes(value as Language);
}

export function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Local storage can be unavailable in private modes; the default is safe.
  }
  return 'en';
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? match : String(value);
  });
}

export function translate(
  language: Language,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dictionary = DICTIONARIES[language] as Record<string, string | undefined>;
  const fallback = en as Record<string, string | undefined>;
  const template = dictionary[key] ?? fallback[key] ?? key;
  return interpolate(template, vars);
}

export interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage());

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The interface still switches for this session when storage is unavailable.
    }
  }, []);

  const dir = dirFor(language);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', language);
    root.setAttribute('dir', dir);
    root.classList.toggle('lang-ar', language === 'ar');
    document.title = translate(language, 'app.name');
  }, [language, dir]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, vars) => translate(language, key, vars),
      dir,
      isRtl: dir === 'rtl',
    }),
    [language, setLanguage, dir],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider.');
  return context;
}

const SERVER_ERROR_KEYS: Record<string, TranslationKey> = {
  AUTH_REQUIRED: 'error.unauthorized',
  AUTH_UNKNOWN: 'error.demoUserMissing',
  USER_SUSPENDED: 'error.forbidden',
  ROLE_MISMATCH: 'error.forbidden',
  FORBIDDEN: 'error.forbidden',
  ORIGIN_NOT_ALLOWED: 'error.forbidden',
  NOT_FOUND: 'error.notFound',
  EMAIL_IN_USE: 'error.emailInUse',
  INSUFFICIENT_STOCK: 'error.insufficientStock',
  NEGATIVE_STOCK_ON_REVERSAL: 'error.negativeStock',
  INCOMPATIBLE_UNITS: 'error.incompatibleUnits',
  INCOMPATIBLE_APPLIED_QUANTITY: 'error.incompatibleUnits',
  OUT_OF_SCOPE: 'error.outOfScope',
  ALREADY_REVERSED: 'error.alreadyReversed',
  TREATMENT_ALREADY_REVERSED: 'error.alreadyReversed',
  SELF_REGISTRATION_DISABLED: 'error.selfRegistrationDisabled',
  INVALID_BACKUP: 'error.invalidBackup',
  CROP_HAS_TREATMENTS: 'error.cropHasTreatments',
  OWNER_IMMUTABLE: 'error.ownerImmutable',
  PRODUCT_ARCHIVED: 'error.productArchived',
  HOLDING_ARCHIVED: 'error.holdingArchived',
  FARMER_NOT_APPROVED: 'error.farmerNotApproved',
  REGISTRATION_ALREADY_REVIEWED: 'error.registrationReviewed',
  TREATMENT_REVERSED: 'error.treatmentReversed',
  LINKED_TO_TREATMENT: 'error.movementLinked',
  INVALID_QUANTITY: 'error.invalidQuantity',
  USE_TREATMENT_SERVICE: 'error.useTreatmentService',
  NO_FARMER_PROFILE: 'error.noFarmerProfile',
  INVALID_DATE_RANGE: 'error.invalidDateRange',
  REPORT_FORBIDDEN: 'error.reportForbidden',
  SEED_DATA_MISSING: 'error.seedMissing',
};

export function translateServerError(
  t: I18nContextValue['t'],
  code: string | undefined,
  fallbackMessage?: string,
): string {
  if (code && SERVER_ERROR_KEYS[code]) return t(SERVER_ERROR_KEYS[code]);
  if (fallbackMessage) return fallbackMessage;
  return t('error.generic');
}

/** Renders a dictionary value that may itself be a validation key. */
export function translateValidationMessage(t: I18nContextValue['t'], message?: string): string {
  if (!message) return '';
  if (message.startsWith('validation.')) return t(message);
  return message;
}
