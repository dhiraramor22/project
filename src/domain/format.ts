import type { Language } from './types';

export const LOCALES: Record<Language, string> = {
  en: 'en-GB',
  fr: 'fr-DZ',
  ar: 'ar-DZ-u-nu-latn',
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
};

export function formatDate(value: string | undefined, language: Language): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(LOCALES[language], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export function formatDateTime(value: string | undefined, language: Language): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(LOCALES[language], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatNumber(
  value: number | null | undefined,
  language: Language,
  maximumFractionDigits = 2,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(LOCALES[language], {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatArea(value: number | null | undefined, language: Language): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${formatNumber(value, language, 2)} ha`;
}

/** Converts a date/datetime string to the `YYYY-MM-DD` form used by date inputs. */
export function toDateInput(value: string | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** Current local calendar date as `YYYY-MM-DD`, used in print headers. */
export function isoDate(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function monthKey(value: string): string {  return value.slice(0, 7);
}

export function monthLabel(key: string, language: Language): string {
  const date = new Date(`${key}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat(LOCALES[language], { month: 'short', year: '2-digit' }).format(date);
}

export function plusMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}
