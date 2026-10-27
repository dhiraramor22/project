import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Leaf,
  ShieldCheck,
  Sprout,
  TriangleAlert,
} from 'lucide-react';
import type { RegistrationFormState } from '../domain/schemas';
import { registrationSchema } from '../domain/schemas';
import {
  translateServerError,
  translateValidationMessage,
  useI18n,
} from '../i18n';
import { useWorkspace } from '../app/WorkspaceProvider';
import { repository } from '../repositories';
import type { PublicRegistrationResult } from '../repositories/types';
import { ApiRequestError } from '../services/apiClient';
import { numberValue, useZodForm } from '../utils/forms';
import { Logo } from '../components/layout/Logo';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from '../components/ui/primitives';

const DEFAULT_VALUES: RegistrationFormState = {
  fullName: '',
  email: '',
  phone: '',
  preferredLanguage: 'en',
  holdingName: '',
  commune: '',
  cultivatedAreaHa: undefined as unknown as number,
  mainCrops: '',
  agriculturalId: '',
  supportingInfo: '',
  consent: false,
};

export function RegisterPage() {
  const { t } = useI18n();
  const { publicConfig, status } = useWorkspace();
  const [result, setResult] = useState<PublicRegistrationResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useZodForm<RegistrationFormState>(registrationSchema, DEFAULT_VALUES);

  const onSubmit = async (values: RegistrationFormState) => {
    setSubmitError(null);
    try {
      const created = await repository.submitRegistration({
        ...values,
        consent: true,
      });
      setResult(created);
      reset(DEFAULT_VALUES);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setSubmitError(translateServerError(t, error.code, error.message));
      } else {
        setSubmitError(t('auth.registration.failed'));
      }
    }
  };

  if (status === 'loading' || !publicConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-50">
        <Spinner label={t('common.loadingData')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/login" className="flex items-center gap-3">
            <Logo withText />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-700 hover:border-forest-300"
            >
              <ArrowLeft size={14} className="rtl:rotate-180" aria-hidden />
              {t('auth.backToLogin')}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <aside className="space-y-4">
            <Card className="bg-forest-950 text-sand-100">
              <Badge tone="clay" className="border-clay-500/40 bg-clay-500/15 text-clay-200">
                {t('app.prototype')}
              </Badge>
              <h1 className="mt-4 font-display text-2xl font-bold leading-tight text-white">
                {t('auth.registration.title')}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-sand-300">
                {t('auth.registration.subtitle')}
              </p>
              <ul className="mt-5 space-y-2.5 text-xs text-sand-300">
                {[
                  t('auth.registration.pendingNote'),
                  t('auth.registration.requiredNote'),
                  t('app.localOnly'),
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-forest-300" aria-hidden />
                    <span className="leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <AlertBanner tone="warning" title={t('auth.demoWarning')}>
              <p>{t('auth.noPassword')}</p>
            </AlertBanner>
          </aside>

          <div>
            {!publicConfig.allowSelfRegistration ? (
              <Card>
                <div className="flex flex-col items-center py-8 text-center">
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                    <TriangleAlert size={22} aria-hidden />
                  </span>
                  <h2 className="font-display text-xl font-bold text-ink-900">
                    {t('auth.registration.disabledTitle')}
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">
                    {t('auth.registration.disabledText')}
                  </p>
                  <Link
                    to="/login"
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-900"
                  >
                    <ArrowLeft size={15} className="rtl:rotate-180" aria-hidden />
                    {t('auth.backToLogin')}
                  </Link>
                </div>
              </Card>
            ) : result ? (
              <Card>
                <div className="flex flex-col items-center py-6 text-center">
                  <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-700">
                    <ClipboardList size={26} aria-hidden />
                  </span>
                  <h2 className="font-display text-xl font-bold text-ink-900">
                    {t('auth.registration.successTitle')}
                  </h2>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-500">
                    {t('auth.registration.successText')}
                  </p>
                  <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50/70 px-4 py-3 text-xs text-ink-600">
                    <p>
                      <span className="font-semibold">{t('registrations.requestId')}: </span>
                      <span className="font-mono">{result.requestId}</span>
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">{t('common.status')}: </span>
                      {t(`status.${result.status}`)}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-900"
                    >
                      <ArrowLeft size={15} className="rtl:rotate-180" aria-hidden />
                      {t('auth.backToLogin')}
                    </Link>
                    <Button variant="outline" onClick={() => setResult(null)}>
                      {t('auth.registration.submit')}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card>
                <div className="mb-5 flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                    <Sprout size={20} aria-hidden />
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-bold text-ink-900">
                      {t('auth.registration.personal')}
                    </h2>
                    <p className="mt-1 text-sm text-ink-500">{t('auth.registration.requiredNote')}</p>
                  </div>
                </div>

                {submitError ? (
                  <AlertBanner tone="danger" title={t('auth.registration.failed')} className="mb-4">
                    {submitError}
                  </AlertBanner>
                ) : null}

                <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label={t('field.fullName')}
                      htmlFor="reg-name"
                      required
                      error={translateValidationMessage(t, errors.fullName?.message)}
                    >
                      <Input id="reg-name" autoComplete="name" {...register('fullName')} />
                    </Field>
                    <Field
                      label={t('field.email')}
                      htmlFor="reg-email"
                      required
                      error={translateValidationMessage(t, errors.email?.message)}
                    >
                      <Input id="reg-email" type="email" autoComplete="email" {...register('email')} />
                    </Field>
                    <Field
                      label={t('field.phone')}
                      htmlFor="reg-phone"
                      required
                      error={translateValidationMessage(t, errors.phone?.message)}
                    >
                      <Input id="reg-phone" type="tel" autoComplete="tel" {...register('phone')} />
                    </Field>
                    <Field
                      label={t('field.language')}
                      htmlFor="reg-language"
                      error={translateValidationMessage(t, errors.preferredLanguage?.message)}
                    >
                      <Select id="reg-language" {...register('preferredLanguage')}>
                        <option value="en">{t('common.english')}</option>
                        <option value="fr">{t('common.french')}</option>
                        <option value="ar">{t('common.arabic')}</option>
                      </Select>
                    </Field>
                  </div>

                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-700">
                      <Leaf size={15} aria-hidden />
                      {t('auth.registration.holding')}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label={t('field.holdingName')}
                        htmlFor="reg-holding"
                        required
                        hint={t('auth.registration.holdingHint')}
                        error={translateValidationMessage(t, errors.holdingName?.message)}
                      >
                        <Input id="reg-holding" {...register('holdingName')} />
                      </Field>
                      <Field
                        label={t('field.commune')}
                        htmlFor="reg-commune"
                        required
                        hint={t('auth.registration.communeHint')}
                        error={translateValidationMessage(t, errors.commune?.message)}
                      >
                        <Select id="reg-commune" {...register('commune')}>
                          <option value="">{t('common.selectCommune')}</option>
                          {publicConfig.communes.map((commune) => (
                            <option key={commune} value={commune}>
                              {commune}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field
                        label={t('field.cultivatedArea')}
                        htmlFor="reg-area"
                        required
                        hint={t('auth.registration.areaHint')}
                        error={translateValidationMessage(t, errors.cultivatedAreaHa?.message)}
                      >
                        <Input
                          id="reg-area"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          {...register('cultivatedAreaHa', numberValue)}
                        />
                      </Field>
                      <Field
                        label={t('field.mainCrops')}
                        htmlFor="reg-crops"
                        required
                        hint={t('auth.registration.cropsHint')}
                        error={translateValidationMessage(t, errors.mainCrops?.message)}
                      >
                        <Input id="reg-crops" {...register('mainCrops')} />
                      </Field>
                      <Field
                        label={t('auth.registration.agriculturalId')}
                        htmlFor="reg-agri-id"
                        error={translateValidationMessage(t, errors.agriculturalId?.message)}
                      >
                        <Input id="reg-agri-id" {...register('agriculturalId')} />
                      </Field>
                      <Field
                        label={t('auth.registration.supportingInfo')}
                        htmlFor="reg-support"
                        className="sm:col-span-2"
                        error={translateValidationMessage(t, errors.supportingInfo?.message)}
                      >
                        <Textarea id="reg-support" rows={3} {...register('supportingInfo')} />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-4">
                    <Checkbox
                      id="reg-consent"
                      label={t('auth.registration.consent')}
                      {...register('consent')}
                    />
                    {errors.consent ? (
                      <p className="mt-1.5 text-xs font-medium text-red-700" role="alert">
                        {translateValidationMessage(t, errors.consent.message)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
                    <p className="flex items-center gap-1.5 text-xs text-ink-500">
                      <ShieldCheck size={14} className="text-forest-600" aria-hidden />
                      {t('auth.registration.pendingNote')}
                    </p>
                    <Button type="submit" loading={isSubmitting} size="lg">
                      {t('auth.registration.submit')}
                    </Button>
                  </div>
                </form>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
