import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { en, type TranslationKey } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';
import { ar } from '../src/i18n/ar';
import {
  dirFor,
  I18nProvider,
  isLanguage,
  readStoredLanguage,
  translate,
  translateServerError,
  translateValidationMessage,
  useI18n,
} from '../src/i18n';

const englishKeys = Object.keys(en) as TranslationKey[];

describe('dictionary completeness', () => {
  it('contains the same key set in English, French and Arabic', () => {
    const english = new Set<string>(Object.keys(en));
    const french = new Set<string>(Object.keys(fr));
    const arabic = new Set<string>(Object.keys(ar));

    expect(english.size).toBeGreaterThan(1200);
    expect([...english].filter((key) => !french.has(key))).toEqual([]);
    expect([...english].filter((key) => !arabic.has(key))).toEqual([]);
    expect([...french].filter((key) => !english.has(key))).toEqual([]);
    expect([...arabic].filter((key) => !english.has(key))).toEqual([]);
  });

  it('does not leave blank translations', () => {
    for (const key of englishKeys) {
      expect(String(en[key]).trim().length, `en:${key}`).toBeGreaterThan(0);
      expect(String(fr[key]).trim().length, `fr:${key}`).toBeGreaterThan(0);
      expect(String(ar[key]).trim().length, `ar:${key}`).toBeGreaterThan(0);
    }
  });

  it('translates core labels into French and Arabic', () => {
    expect(translate('fr', 'nav.dashboard')).toBe('Tableau de bord');
    expect(translate('ar', 'nav.dashboard')).not.toBe('Dashboard');
    expect(translate('ar', 'app.name')).not.toBe('El Oued Pesticide Management Platform');
    expect(translate('en', 'app.name')).toBe('El Oued Pesticide Management Platform');
  });

  it('falls back to the key itself for unknown entries', () => {
    expect(translate('fr', 'not.a.real.key')).toBe('not.a.real.key');
    expect(translate('en', 'not.a.real.key')).toBe('not.a.real.key');
  });

  it('interpolates values and leaves unknown placeholders intact', () => {
    expect(translate('en', 'common.showingRecords', { count: 3, total: 9 })).toContain('3');
    expect(translate('en', 'common.showingRecords', { count: 3, total: 9 })).toContain('9');
    expect(translate('en', 'common.save', { ignored: 'x' })).toBe('Save');
  });

  it('maps server and validation error codes to translated messages', () => {
    const t = (key: string, vars?: Record<string, string | number>) => translate('fr', key, vars);
    expect(translateServerError(t, 'INSUFFICIENT_STOCK')).toBe(translate('fr', 'error.insufficientStock'));
    expect(translateServerError(t, 'UNKNOWN')).toBe(translate('fr', 'error.generic'));
    expect(translateServerError(t, undefined, 'Raw server message')).toBe('Raw server message');
    expect(translateValidationMessage(t, 'validation.required')).toBe(translate('fr', 'validation.required'));
    expect(translateValidationMessage(t, 'Custom message')).toBe('Custom message');
  });
});

describe('language and direction handling', () => {
  it('maps only Arabic to RTL', () => {
    expect(dirFor('en')).toBe('ltr');
    expect(dirFor('fr')).toBe('ltr');
    expect(dirFor('ar')).toBe('rtl');
    expect(isLanguage('ar')).toBe(true);
    expect(isLanguage('es')).toBe(false);
  });

  it('reads and persists the language locally', () => {
    expect(readStoredLanguage()).toBe('en');
    window.localStorage.setItem('eloued.language', 'ar');
    expect(readStoredLanguage()).toBe('ar');
    window.localStorage.setItem('eloued.language', 'de');
    expect(readStoredLanguage()).toBe('en');
  });

  it('sets document language/direction and switches without a reload', async () => {
    window.localStorage.setItem('eloued.language', 'ar');

    function Probe() {
      const { language, dir, t, setLanguage } = useI18n();
      return (
        <div>
          <p data-testid="state">{`${language}|${dir}`}</p>
          <p data-testid="title">{t('app.name')}</p>
          <button type="button" onClick={() => setLanguage('fr')}>
            Switch to French
          </button>
        </div>
      );
    }

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ar|rtl'));
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.classList.contains('lang-ar')).toBe(true);
    expect(screen.getByTestId('title').textContent).toBe(String(ar['app.name']));

    fireEvent.click(screen.getByRole('button', { name: 'Switch to French' }));

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('fr|ltr'));
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.classList.contains('lang-ar')).toBe(false);
    expect(window.localStorage.getItem('eloued.language')).toBe('fr');
  });
});
