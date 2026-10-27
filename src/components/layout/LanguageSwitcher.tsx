import { Globe2 } from 'lucide-react';
import { LANGUAGE_LABELS } from '../../domain/format';
import type { Language } from '../../domain/types';
import { SUPPORTED_LANGUAGES, useI18n } from '../../i18n';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useI18n();
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600">
      <Globe2 size={14} aria-hidden />
      <span className={compact ? 'sr-only' : 'hidden sm:inline'}>{t('common.language')}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="cursor-pointer bg-transparent py-0.5 text-xs font-semibold text-ink-800 outline-none"
        aria-label={t('common.language')}
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
