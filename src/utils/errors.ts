import type { I18nContextValue } from '../i18n';
import { translateServerError } from '../i18n';
import { ApiRequestError } from '../services/apiClient';

export function errorText(t: I18nContextValue['t'], error: unknown): string {
  if (error instanceof ApiRequestError) {
    return translateServerError(t, error.code, error.message);
  }
  if (error instanceof Error && error.message) return error.message;
  return t('error.generic');
}

export function warningText(t: I18nContextValue['t'], code: string): string {
  const key = `warning.${code}`;
  const value = t(key);
  return value === key ? code : value;
}
