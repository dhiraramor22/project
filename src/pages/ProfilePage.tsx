import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Calendar,
  Languages,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Sprout,
  UserRound,
} from 'lucide-react';
import type { FarmerSelfInput } from '../domain/schemas';
import { farmerUpdateSchema } from '../domain/schemas';
import { ROLE_DEFINITIONS } from '../domain/permissions';
import { formatDateTime } from '../domain/format';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { roleTone, statusTone } from '../app/status';
import { useAction } from '../app/useAction';
import { translateValidationMessage, useI18n } from '../i18n';
import { repository } from '../repositories';
import { useZodForm } from '../utils/forms';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  DemoBadge,
  Field,
  Input,
  KeyValue,
  PageHeader,
  Select,
  Textarea,
} from '../components/ui/primitives';

export function ProfilePage() {
  const { t, language, setLanguage } = useI18n();
  const data = useWorkspaceData();
  const { farmer, can, refresh } = useWorkspace();
  const { busy, error, run } = useAction();
  const [info, setInfo] = useState<string | null>(null);

  const roleDefinition = ROLE_DEFINITIONS[data.role];

  const defaults: FarmerSelfInput = {
    fullName: farmer?.fullName ?? data.user.fullName,
    email: farmer?.email ?? data.user.email,
    phone: farmer?.phone ?? data.user.phone ?? '',
    preferredLanguage: farmer?.preferredLanguage ?? data.user.preferredLanguage,
    agriculturalId: farmer?.agriculturalId ?? '',
    supportingInfo: farmer?.supportingInfo ?? '',
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useZodForm<FarmerSelfInput>(farmerUpdateSchema, defaults);

  useEffect(() => {
    reset(defaults);
    // The farmer record is the source of truth when it is linked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmer, data.user, reset]);

  const submit = async (values: FarmerSelfInput) => {
    setInfo(null);
    await run('profile', () => repository.updateOwnFarmer(values), {
      success: t('profile.saved'),
      onSuccess: async () => {
        if (values.preferredLanguage !== language) setLanguage(values.preferredLanguage);
        await refresh();
      },
    });
  };

  const canEdit = can('farmer:self:manage') && Boolean(farmer);

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.section.system')}
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
        actions={<DemoBadge />}
      />

      <AlertBanner tone="warning" className="mb-5" title={t('profile.demoNotice')}>
        <p>{t('app.roleSimulation')}</p>
      </AlertBanner>

      {error ? (
        <AlertBanner tone="danger" className="mb-5" title={t('common.error')}>
          {error}
        </AlertBanner>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            icon={UserRound}
            title={t('profile.personal')}
            subtitle={t('profile.editInfo')}
          />
          {canEdit ? (
            <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('field.fullName')}
                  htmlFor="profile-name"
                  required
                  error={translateValidationMessage(t, errors.fullName?.message)}
                >
                  <Input id="profile-name" {...register('fullName')} />
                </Field>
                <Field
                  label={t('field.email')}
                  htmlFor="profile-email"
                  required
                  error={translateValidationMessage(t, errors.email?.message)}
                >
                  <Input id="profile-email" type="email" {...register('email')} />
                </Field>
                <Field
                  label={t('field.phone')}
                  htmlFor="profile-phone"
                  required
                  error={translateValidationMessage(t, errors.phone?.message)}
                >
                  <Input id="profile-phone" type="tel" {...register('phone')} />
                </Field>
                <Field
                  label={t('field.language')}
                  htmlFor="profile-language"
                  hint={t('profile.languageHint')}
                  error={translateValidationMessage(t, errors.preferredLanguage?.message)}
                >
                  <Select id="profile-language" {...register('preferredLanguage')}>
                    <option value="en">{t('common.english')}</option>
                    <option value="fr">{t('common.french')}</option>
                    <option value="ar">{t('common.arabic')}</option>
                  </Select>
                </Field>
                <Field
                  label={t('farmers.agriculturalId')}
                  htmlFor="profile-agri"
                  error={translateValidationMessage(t, errors.agriculturalId?.message)}
                >
                  <Input id="profile-agri" {...register('agriculturalId')} />
                </Field>
                <Field label={t('field.commune')} htmlFor="profile-commune">
                  <Input id="profile-commune" value={farmer?.commune ?? ''} disabled readOnly />
                </Field>
                <Field
                  label={t('field.supportingInfo')}
                  htmlFor="profile-support"
                  className="sm:col-span-2"
                  error={translateValidationMessage(t, errors.supportingInfo?.message)}
                >
                  <Textarea id="profile-support" rows={3} {...register('supportingInfo')} />
                </Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-relaxed text-ink-500">{t('profile.readOnlyNote')}</p>
                <Button type="submit" icon={Save} loading={isSubmitting || busy === 'profile'}>
                  {t('profile.save')}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <KeyValue label={t('field.fullName')}>{data.user.fullName}</KeyValue>
                <KeyValue label={t('field.email')}>{data.user.email}</KeyValue>
                <KeyValue label={t('field.phone')}>{data.user.phone ?? '—'}</KeyValue>
                <KeyValue label={t('field.language')}>{t(`common.${data.user.preferredLanguage === 'en' ? 'english' : data.user.preferredLanguage === 'fr' ? 'french' : 'arabic'}`)}</KeyValue>
              </dl>
              <p className="rounded-lg border border-ink-100 bg-ink-50/60 px-3 py-2 text-xs leading-relaxed text-ink-600">
                {t('profile.readOnlyNote')}
              </p>
            </div>
          )}
          {info ? (
            <p className="mt-3 text-xs text-forest-800" role="status">
              {info}
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader icon={ShieldCheck} title={t('profile.account')} subtitle={t('profile.roleScope')} />
          <dl className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={roleTone(data.role)}>{t(roleDefinition.labelKey)}</Badge>
              <Badge tone={statusTone(data.user.status)}>{t(`status.${data.user.status}`)}</Badge>
              <Badge tone="clay">{t('common.demo')}</Badge>
            </div>
            <KeyValue label={t('profile.accountStatus')}>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck size={14} className="text-forest-700" aria-hidden />
                {t(`status.${data.user.status}`)}
              </span>
            </KeyValue>
            <KeyValue label={t('field.commune')}>
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} className="text-ink-400" aria-hidden />
                {data.scopeCommunes?.length
                  ? data.scopeCommunes.join(', ')
                  : data.role === 'FARMER'
                    ? farmer?.commune ?? '—'
                    : t('role.scope.province')}
              </span>
            </KeyValue>
            <KeyValue label={t('common.permissions')}>
              {data.permissions.length} {t('common.permissions')}
            </KeyValue>
            <KeyValue label={t('common.createdAt')}>
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={13} className="text-ink-400" aria-hidden />
                {formatDateTime(data.user.createdAt, language)}
              </span>
            </KeyValue>
            <KeyValue label={t('common.language')}>
              <span className="inline-flex items-center gap-1.5">
                <Languages size={13} className="text-ink-400" aria-hidden />
                {t('profile.languageHint')}
              </span>
            </KeyValue>
          </dl>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader icon={Sprout} title={t('profile.linkedFarmer')} subtitle={t('profile.farmerProfile')} />
          {farmer ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <KeyValue label={t('field.id')}>{farmer.id}</KeyValue>
              <KeyValue label={t('field.fullName')}>{farmer.fullName}</KeyValue>
              <KeyValue label={t('field.commune')}>{farmer.commune}</KeyValue>
              <KeyValue label={t('field.status')}>
                <Badge tone={statusTone(farmer.status)}>{t(`status.${farmer.status}`)}</Badge>
              </KeyValue>
              <KeyValue label={t('field.email')}>
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={13} className="text-ink-400" aria-hidden /> {farmer.email}
                </span>
              </KeyValue>
              <KeyValue label={t('field.phone')}>
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={13} className="text-ink-400" aria-hidden /> {farmer.phone}
                </span>
              </KeyValue>
            </dl>
          ) : (
            <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
              {t('profile.notLinked')}
            </p>
          )}
        </Card>

        <Card>
          <CardHeader icon={Building2} title={t('profile.roleScope')} subtitle={t(roleDefinition.descriptionKey)} />
          <p className="text-xs leading-relaxed text-ink-600">{t(roleDefinition.demoNoticeKey)}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {data.permissions.map((permission) => (
              <span
                key={permission}
                className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 font-mono text-[10px] text-ink-600"
              >
                {permission}
              </span>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
            {t('profile.readOnlyNote')} {t('app.roleSimulation')}
          </p>
        </Card>
      </div>

      <div className="mt-5">
        <Card>
          <CardHeader icon={Languages} title={t('common.language')} subtitle={t('profile.languageHint')} />
          <div className="flex flex-wrap gap-2">
            {(['en', 'fr', 'ar'] as const).map((code) => (
              <Button
                key={code}
                variant={language === code ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setLanguage(code)}
              >
                {t(`common.${code === 'en' ? 'english' : code === 'fr' ? 'french' : 'arabic'}`)}
              </Button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-ink-400">{t('settings.languageNote')}</p>
        </Card>
      </div>
    </div>
  );
}
