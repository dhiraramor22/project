import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Leaf,
  ShieldCheck,
  Sprout,
  TriangleAlert,
} from 'lucide-react';
import { ROLE_DEFINITIONS } from '../domain/permissions';
import type { Permission, Role } from '../domain/types';
import { useI18n, translateServerError } from '../i18n';
import { useWorkspace } from '../app/WorkspaceProvider';
import { ApiRequestError } from '../services/apiClient';
import { AlertBanner, Badge, Button, Card, Spinner } from '../components/ui/primitives';
import { Logo } from '../components/layout/Logo';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';
import { roleTone } from '../app/status';

const ROLE_ICONS = {
  DSA_ADMIN: ShieldCheck,
  CHAMBER_ADMIN: Building2,
  FARMER: Sprout,
} as const;

export function LoginPage() {
  const { t, language } = useI18n();
  const { publicConfig, demoUsers, login, status, errorCode } = useWorkspace();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (userId: string) => {
    setBusy(userId);
    setError(null);
    try {
      await login(userId);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setError(translateServerError(t, caught.code, caught.message));
      } else {
        setError(t('error.generic'));
      }
    } finally {
      setBusy(null);
    }
  };

  if (status === 'loading' || !publicConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-50">
        <Spinner label={t('auth.loading')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-50">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <aside className="relative overflow-hidden bg-forest-950 px-6 py-8 text-sand-100 sm:px-10 lg:px-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 15% 20%, rgba(201,138,46,0.35), transparent 35%), radial-gradient(circle at 85% 75%, rgba(58,145,107,0.4), transparent 45%)',
            }}
            aria-hidden
          />
          <div className="relative flex h-full flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Logo inverted withText size="lg" />
              <LanguageSwitcher />
            </div>
            <div className="mt-14 max-w-xl lg:mt-24">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-clay-300">
                {t('app.institution')}
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
                {t('app.name')}
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-sand-300">{t('app.tagline')}</p>

              <ul className="mt-8 space-y-3 text-sm text-sand-200">
                {[
                  t('app.localOnly'),
                  t('auth.noPassword'),
                  t('auth.demoWarning'),
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-forest-300" aria-hidden />
                    <span className="leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto pt-10">
              <div className="rounded-xl border border-forest-800 bg-forest-900/70 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-clay-200">
                  <TriangleAlert size={14} aria-hidden />
                  {t('app.prototypeNotice')}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-sand-400">{t('app.demoData')} · {t('auth.localOnly')}</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex items-start justify-center px-4 py-8 sm:px-8 lg:items-center lg:py-12">
          <div className="w-full max-w-3xl">
            <div className="mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-600">
                {t('app.prototype')}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ink-900 sm:text-3xl">
                {t('auth.title')}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">{t('auth.subtitle')}</p>
            </div>

            {error || status === 'error' ? (
              <AlertBanner tone="danger" title={t('common.error')} className="mb-4">
                {error ?? translateServerError(t, errorCode ?? undefined)}
              </AlertBanner>
            ) : null}

            <AlertBanner tone="warning" title={((import.meta as any).env?.VITE_PREVIEW_MODE === 'true') || (typeof window !== 'undefined' && (window.location.hostname.includes('.vercel.app') || window.location.hostname.includes('.vercel.com'))) ? 'DEMO PREVIEW MODE' : t('auth.demoWarning')} className="mb-5">
              <p>
                {((import.meta as any).env?.VITE_PREVIEW_MODE === 'true') || (typeof window !== 'undefined' && (window.location.hostname.includes('.vercel.app') || window.location.hostname.includes('.vercel.com')))
                  ? 'UI inspection only - No backend connected. Changes are not persisted. This is not secure authentication.'
                  : t('auth.noPassword')}
              </p>
            </AlertBanner>

            <div className="grid gap-3">
              {demoUsers.map((identity) => {
                const role = identity.role as Role;
                const definition = ROLE_DEFINITIONS[role];
                const Icon = ROLE_ICONS[role];
                const permissions = identity.permissions as Permission[];
                return (
                  <Card key={identity.id} className="transition hover:border-forest-200 hover:shadow-pop">
                    <div className="flex flex-wrap items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                        <Icon size={23} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-base font-semibold text-ink-900">
                            {identity.fullName}
                          </h3>
                          <Badge tone={roleTone(role)}>{t(definition.labelKey)}</Badge>
                          <Badge tone="clay">{t('auth.fictionalIdentity')}</Badge>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                          {t(definition.descriptionKey)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                          <span>
                            <span className="font-semibold text-ink-700">{t('auth.scope')}:</span>{' '}
                            {identity.scopeCommunes?.length
                              ? t('role.scope.communes', { communes: identity.scopeCommunes.join(', ') })
                              : t('role.scope.province')}
                          </span>
                          <span>
                            <span className="font-semibold text-ink-700">{t('common.demo')}:</span>{' '}
                            {permissions.length} {t('common.permissions')}
                          </span>
                          <span>{t(definition.demoNoticeKey)}</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => void handleLogin(identity.id)}
                        loading={busy === identity.id}
                        disabled={busy !== null}
                        iconEnd={ArrowRight}
                        className="w-full sm:w-auto"
                      >
                        {t('auth.enterAs', {
                          role: t(definition.labelKey),
                        })}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-ink-800">{t('auth.selfRegister')}</p>
                <p className="text-xs text-ink-500">{t('auth.registration.subtitle')}</p>
              </div>
              {publicConfig.allowSelfRegistration ? (
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-forest-50 px-3 py-2 text-xs font-semibold text-forest-800 hover:bg-forest-100"
                >
                  <Leaf size={14} aria-hidden />
                  {t('auth.selfRegister')}
                </Link>
              ) : (
                <span className="text-xs text-ink-500">{t('auth.registrationClosed')}</span>
              )}
            </div>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-400">
              {t('auth.demoIdentityNote')} · {t('app.localOnly')} ·{' '}
              <span className="font-mono">{language.toUpperCase()}</span>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
