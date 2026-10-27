import { useCallback, useState } from 'react';
import { useToast } from '../components/ui/ToastProvider';
import { translateServerError, useI18n } from '../i18n';
import { ApiRequestError } from '../services/apiClient';

/**
 * Small wrapper for one-off local service actions. It keeps a busy key, a
 * translated error message and an optional success toast in one place.
 */
export function useAction() {
  const { t } = useI18n();
  const { notify } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const run = useCallback(
    async <T,>(
      key: string,
      action: () => Promise<T>,
      options: { success?: string; onSuccess?: (result: T) => void | Promise<void> } = {},
    ): Promise<T | null> => {
      setBusy(key);
      setError(null);
      try {
        const result = await action();
        if (options.onSuccess) await options.onSuccess(result);
        if (options.success) notify(options.success);
        return result;
      } catch (caught) {
        if (caught instanceof ApiRequestError) {
          setError(translateServerError(t, caught.code, caught.message));
        } else {
          setError(t('error.generic'));
        }
        return null;
      } finally {
        setBusy(null);
      }
    },
    [notify, t],
  );

  return { busy, error, setError, clearError, run };
}
