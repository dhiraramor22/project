import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  Database,
  Download,
  HardDriveDownload,
  Pencil,
  RotateCcw,
  Save,
  Settings2,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import type { AgriculturalSeason, TFIConfiguration } from '../domain/types';
import type { BackupSummary } from '../repositories/types';
import { seasonSchema, settingsSchema } from '../domain/schemas';
import { formatArea, formatDate, formatDateTime, formatNumber } from '../domain/format';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { statusTone } from '../app/status';
import { useAction } from '../app/useAction';
import { translateServerError, translateValidationMessage, useI18n } from '../i18n';
import { repository } from '../repositories';
import { ApiRequestError, saveBlob } from '../services/apiClient';
import { isoDate } from '../utils/export';
import { joinList, splitList, useZodForm } from '../utils/forms';
import { useToast } from '../components/ui/ToastProvider';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  DemoBadge,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  TableBody,
  TableHead,
  TableRow,
  TableTd,
  TableTh,
  TableWrap,
  Textarea,
  cx,
} from '../components/ui/primitives';

interface SeasonValues {
  label: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'CLOSED';
}

const SEASON_DEFAULTS: SeasonValues = {
  label: '',
  startDate: `${new Date().getFullYear()}-01-01`,
  endDate: `${new Date().getFullYear()}-12-31`,
  status: 'ACTIVE',
};

function SeasonModal({
  open,
  season,
  onClose,
  onSaved,
}: {
  open: boolean;
  season: AgriculturalSeason | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const { notify } = useToast();
  const [error, setError] = useState<string | null>(null);
  const defaults: SeasonValues = season
    ? {
        label: season.label,
        startDate: season.startDate,
        endDate: season.endDate,
        status: season.status,
      }
    : SEASON_DEFAULTS;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useZodForm<SeasonValues>(seasonSchema, defaults);

  useEffect(() => {
    if (open) {
      reset(defaults);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, season, reset]);

  const submit = async (values: SeasonValues) => {
    setError(null);
    try {
      if (season) {
        await repository.updateSeason(season.id, values);
        notify(t('settings.seasonUpdated'));
      } else {
        await repository.createSeason(values);
        notify(t('settings.seasonCreated'));
      }
      onClose();
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? translateServerError(t, caught.code, caught.message)
          : t('error.generic'),
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={season ? t('settings.editSeason') : t('settings.addSeason')}
      description={t('settings.seasonsDescription')}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="season-form"
            loading={isSubmitting}
            icon={season ? Save : CalendarPlus}
          >
            {season ? t('common.saveChanges') : t('common.create')}
          </Button>
        </>
      }
    >
      {error ? (
        <AlertBanner tone="danger" className="mb-4" title={t('common.error')}>
          {error}
        </AlertBanner>
      ) : null}
      <form id="season-form" className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <Field
          label={t('settings.seasonLabel')}
          htmlFor="season-label"
          required
          error={translateValidationMessage(t, errors.label?.message)}
        >
          <Input id="season-label" {...register('label')} placeholder="2026-2027" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('settings.startDate')}
            htmlFor="season-start"
            required
            error={translateValidationMessage(t, errors.startDate?.message)}
          >
            <Input id="season-start" type="date" {...register('startDate')} />
          </Field>
          <Field
            label={t('settings.endDate')}
            htmlFor="season-end"
            required
            error={translateValidationMessage(t, errors.endDate?.message)}
          >
            <Input id="season-end" type="date" {...register('endDate')} />
          </Field>
        </div>
        <Field
          label={t('settings.seasonStatus')}
          htmlFor="season-status"
          error={translateValidationMessage(t, errors.status?.message)}
        >
          <Select id="season-status" {...register('status')}>
            <option value="ACTIVE">{t('status.ACTIVE')}</option>
            <option value="CLOSED">{t('status.CLOSED')}</option>
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

export function SettingsPage() {
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { refresh, reloadPublicConfig, logout } = useWorkspace();
  const { notify } = useToast();
  const { busy, error: actionError, setError: setActionError, run } = useAction();

  const [general, setGeneral] = useState({
    applicationName: data.settings.applicationName,
    institution: data.settings.institution,
    lowStockThreshold: String(data.settings.lowStockThreshold),
    allowSelfRegistration: data.settings.allowSelfRegistration,
    defaultLanguage: data.settings.defaultLanguage,
    communes: joinList(data.settings.communes),
    cropCategories: joinList(data.settings.cropCategories),
    cropSuggestions: joinList(data.settings.cropSuggestions),
  });
  const [formError, setFormError] = useState<string | null>(null);

  const [tfi, setTfi] = useState<TFIConfiguration>(data.tfiConfig);

  const [seasonOpen, setSeasonOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<AgriculturalSeason | null>(null);

  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsError, setBackupsError] = useState<string | null>(null);

  const [pendingImport, setPendingImport] = useState<{ fileName: string; payload: unknown } | null>(null);
  const [importPhrase, setImportPhrase] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setGeneral({
      applicationName: data.settings.applicationName,
      institution: data.settings.institution,
      lowStockThreshold: String(data.settings.lowStockThreshold),
      allowSelfRegistration: data.settings.allowSelfRegistration,
      defaultLanguage: data.settings.defaultLanguage,
      communes: joinList(data.settings.communes),
      cropCategories: joinList(data.settings.cropCategories),
      cropSuggestions: joinList(data.settings.cropSuggestions),
    });
  }, [data.settings]);

  useEffect(() => {
    setTfi(data.tfiConfig);
  }, [data.tfiConfig]);

  const loadBackups = useCallback(async () => {
    setBackupsLoading(true);
    setBackupsError(null);
    try {
      const response = await repository.listBackups();
      setBackups(response.backups);
    } catch (caught) {
      setBackupsError(
        caught instanceof ApiRequestError
          ? translateServerError(t, caught.code, caught.message)
          : t('error.generic'),
      );
    } finally {
      setBackupsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  const seasons = useMemo(
    () => data.seasons.slice().sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [data.seasons],
  );

  const saveGeneral = async () => {
    setFormError(null);
    const parsed = settingsSchema.safeParse({
      applicationName: general.applicationName,
      institution: general.institution,
      lowStockThreshold: Number(general.lowStockThreshold),
      allowSelfRegistration: general.allowSelfRegistration,
      defaultLanguage: general.defaultLanguage,
      communes: splitList(general.communes),
      cropCategories: splitList(general.cropCategories),
      cropSuggestions: splitList(general.cropSuggestions),
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setFormError(translateValidationMessage(t, first?.message));
      return;
    }
    await run('settings', () => repository.updateSettings(parsed.data), {
      success: t('settings.saved'),
      onSuccess: async () => {
        await refresh();
        await reloadPublicConfig();
      },
    });
  };

  const saveTfi = async () => {
    await run(
      'tfi',
      () =>
        repository.updateTfiConfig({
          normalization: tfi.normalization,
          requireVerifiedDose: tfi.requireVerifiedDose,
          allowDemoReferenceDoses: tfi.allowDemoReferenceDoses,
          notes: tfi.notes,
        }),
      {
        success: t('settings.tfiConfigSaved'),
        onSuccess: refresh,
      },
    );
  };

  const downloadBackup = async () => {
    await run(
      'download',
      async () => {
        const result = await repository.downloadBackup();
        saveBlob(result.blob, result.fileName);
        return result.fileName;
      },
      {
        success: t('settings.backupDone'),
        onSuccess: loadBackups,
      },
    );
  };

  const readBackupFile = async (file: File | undefined) => {
    setActionError(null);
    setImportError(null);
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      setPendingImport({ fileName: file.name, payload });
      setImportPhrase('');
      setImportOpen(true);
    } catch {
      setPendingImport(null);
      setActionError(t('settings.importInvalid'));
    }
  };

  const runImport = async () => {
    if (!pendingImport || importPhrase !== 'IMPORT_BACKUP') return;
    setImportError(null);
    setImporting(true);
    try {
      await repository.importBackup(pendingImport.payload);
      setImportOpen(false);
      setPendingImport(null);
      setImportPhrase('');
      notify(t('settings.importDone'));
      try {
        await refresh();
        await reloadPublicConfig();
      } catch {
        logout();
      }
      await loadBackups();
    } catch (caught) {
      setImportError(
        caught instanceof ApiRequestError
          ? translateServerError(t, caught.code, caught.message)
          : t('error.generic'),
      );
    } finally {
      setImporting(false);
    }
  };

  const runReset = async () => {
    if (resetPhrase !== 'RESET_DEMO') return;
    setResetError(null);
    setResetting(true);
    try {
      const result = await repository.resetDemo();
      setResetOpen(false);
      setResetPhrase('');
      notify(`${t('settings.resetDone')} (${result.preResetBackup})`);
      try {
        await refresh();
        await reloadPublicConfig();
      } catch {
        logout();
      }
      await loadBackups();
    } catch (caught) {
      setResetError(
        caught instanceof ApiRequestError
          ? translateServerError(t, caught.code, caught.message)
          : t('error.generic'),
      );
    } finally {
      setResetting(false);
    }
  };

  const backupLabel = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${formatNumber(bytes / 1024, language, 1)} KB`
      : `${formatNumber(bytes / (1024 * 1024), language, 2)} MB`;

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.section.system')}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={<DemoBadge />}
      />

      <AlertBanner tone="info" className="mb-5" title={t('settings.localOnlyNote')}>
        <p>{t('settings.demoModeNote')}</p>
      </AlertBanner>

      {actionError ? (
        <AlertBanner tone="danger" className="mb-5" title={t('common.error')}>
          {actionError}
        </AlertBanner>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            icon={Settings2}
            title={t('settings.general')}
            subtitle={t('settings.subtitle')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.applicationName')} htmlFor="settings-name">
              <Input
                id="settings-name"
                value={general.applicationName}
                onChange={(event) =>
                  setGeneral((current) => ({ ...current, applicationName: event.target.value }))
                }
              />
            </Field>
            <Field label={t('settings.institution')} htmlFor="settings-institution">
              <Input
                id="settings-institution"
                value={general.institution}
                onChange={(event) =>
                  setGeneral((current) => ({ ...current, institution: event.target.value }))
                }
              />
            </Field>
            <Field
              label={t('settings.lowStockThreshold')}
              htmlFor="settings-threshold"
              hint={t('settings.thresholdHint')}
            >
              <Input
                id="settings-threshold"
                type="number"
                min="0"
                step="1"
                value={general.lowStockThreshold}
                onChange={(event) =>
                  setGeneral((current) => ({ ...current, lowStockThreshold: event.target.value }))
                }
              />
            </Field>
            <Field label={t('settings.defaultLanguage')} htmlFor="settings-language">
              <Select
                id="settings-language"
                value={general.defaultLanguage}
                onChange={(event) =>
                  setGeneral((current) => ({
                    ...current,
                    defaultLanguage: event.target.value as 'en' | 'fr' | 'ar',
                  }))
                }
              >
                <option value="en">{t('common.english')}</option>
                <option value="fr">{t('common.french')}</option>
                <option value="ar">{t('common.arabic')}</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Checkbox
              label={t('settings.allowSelfRegistration')}
              checked={general.allowSelfRegistration}
              onChange={(event) =>
                setGeneral((current) => ({ ...current, allowSelfRegistration: event.target.checked }))
              }
            />
          </div>
          <div className="mt-4 space-y-4">
            <Field
              label={t('settings.communes')}
              htmlFor="settings-communes"
              hint={`${t('settings.communesHint')} ${t('settings.commaHint')}`}
            >
              <Textarea
                id="settings-communes"
                rows={3}
                value={general.communes}
                onChange={(event) => setGeneral((current) => ({ ...current, communes: event.target.value }))}
              />
            </Field>
            <Field
              label={t('settings.cropCategories')}
              htmlFor="settings-categories"
              hint={`${t('settings.cropCategoriesHint')} ${t('settings.commaHint')}`}
            >
              <Textarea
                id="settings-categories"
                rows={3}
                value={general.cropCategories}
                onChange={(event) =>
                  setGeneral((current) => ({ ...current, cropCategories: event.target.value }))
                }
              />
            </Field>
            <Field
              label={t('settings.cropSuggestions')}
              htmlFor="settings-crops"
              hint={`${t('settings.cropSuggestionsHint')} ${t('settings.commaHint')}`}
            >
              <Textarea
                id="settings-crops"
                rows={3}
                value={general.cropSuggestions}
                onChange={(event) =>
                  setGeneral((current) => ({ ...current, cropSuggestions: event.target.value }))
                }
              />
            </Field>
          </div>
          {formError ? (
            <p className="mt-3 text-xs font-medium text-red-700" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-500">
              {t('settings.savedAt')}: {formatDateTime(data.settings.updatedAt, language)}
            </p>
            <Button icon={Save} onClick={() => void saveGeneral()} loading={busy === 'settings'}>
              {t('settings.save')}
            </Button>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              icon={Settings2}
              title={t('settings.tfiTitle')}
              subtitle={t('settings.tfiDescription')}
              action={
                <Badge tone="slate">
                  {t('settings.currentVersion', { version: data.tfiConfig.version })}
                </Badge>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('tfi.configNormalization')} htmlFor="settings-tfi-normalization">
                <Select
                  id="settings-tfi-normalization"
                  value={tfi.normalization}
                  onChange={(event) =>
                    setTfi((current) => ({
                      ...current,
                      normalization: event.target.value as 'CROP_AREA' | 'TREATED_AREA',
                    }))
                  }
                >
                  <option value="CROP_AREA">{t('tfi.configCropArea')}</option>
                  <option value="TREATED_AREA">{t('tfi.configTreatedArea')}</option>
                </Select>
              </Field>
              <Field label={t('tfi.configNotes')} htmlFor="settings-tfi-notes">
                <Input
                  id="settings-tfi-notes"
                  value={tfi.notes ?? ''}
                  maxLength={500}
                  onChange={(event) => setTfi((current) => ({ ...current, notes: event.target.value }))}
                />
              </Field>
            </div>
            <div className="mt-4 space-y-3">
              <Checkbox
                label={t('tfi.configRequireVerified')}
                description={t('tfi.requireVerifiedHint')}
                checked={tfi.requireVerifiedDose}
                onChange={(event) =>
                  setTfi((current) => ({ ...current, requireVerifiedDose: event.target.checked }))
                }
              />
              <Checkbox
                label={t('tfi.configAllowDemo')}
                description={t('tfi.allowDemoHint')}
                checked={tfi.allowDemoReferenceDoses}
                onChange={(event) =>
                  setTfi((current) => ({ ...current, allowDemoReferenceDoses: event.target.checked }))
                }
              />
            </div>
            <div className="mt-4 flex items-center justify-end">
              <Button icon={Save} onClick={() => void saveTfi()} loading={busy === 'tfi'}>
                {t('settings.tfiConfigTitle')}
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={CalendarPlus}
              title={t('settings.seasonsTitle')}
              subtitle={t('settings.seasonsDescription')}
              action={
                <Button
                  size="sm"
                  icon={CalendarPlus}
                  onClick={() => {
                    setEditingSeason(null);
                    setSeasonOpen(true);
                  }}
                >
                  {t('settings.addSeason')}
                </Button>
              }
            />
            <TableWrap>
              <TableHead>
                <TableRow>
                  <TableTh>{t('settings.seasonLabel')}</TableTh>
                  <TableTh>{t('settings.startDate')}</TableTh>
                  <TableTh>{t('settings.endDate')}</TableTh>
                  <TableTh>{t('common.status')}</TableTh>
                  <TableTh>{t('common.actions')}</TableTh>
                </TableRow>
              </TableHead>
              <TableBody>
                {seasons.map((season) => (
                  <TableRow key={season.id}>
                    <TableTd className="font-semibold text-ink-800">{season.label}</TableTd>
                    <TableTd className="whitespace-nowrap text-xs">{formatDate(season.startDate, language)}</TableTd>
                    <TableTd className="whitespace-nowrap text-xs">{formatDate(season.endDate, language)}</TableTd>
                    <TableTd>
                      <Badge tone={statusTone(season.status)}>{t(`status.${season.status}`)}</Badge>
                    </TableTd>
                    <TableTd>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        onClick={() => {
                          setEditingSeason(season);
                          setSeasonOpen(true);
                        }}
                      >
                        {t('common.edit')}
                      </Button>
                    </TableTd>
                  </TableRow>
                ))}
              </TableBody>
            </TableWrap>
            <p className="mt-3 text-[11px] text-ink-400">
              {t('settings.seedNote')} · {formatArea(
                data.crops.reduce((sum, crop) => sum + crop.areaHa, 0),
                language,
              )}
            </p>
          </Card>
        </div>
      </div>

      <Card className="mt-5">
        <CardHeader
          icon={Database}
          title={t('settings.dataTitle')}
          subtitle={t('settings.dataDescription')}
          action={<Badge tone="clay">{t('settings.localData')}</Badge>}
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
            <h3 className="text-sm font-bold text-ink-800">{t('settings.downloadBackup')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">{t('settings.downloadBackupDesc')}</p>
            <Button className="mt-3" icon={HardDriveDownload} onClick={() => void downloadBackup()} loading={busy === 'download'}>
              {t('settings.downloadBackup')}
            </Button>
          </div>
          <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
            <h3 className="text-sm font-bold text-ink-800">{t('settings.importBackup')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">{t('settings.importBackupDesc')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label
                htmlFor="backup-file"
                className={cx(
                  'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-800 transition hover:border-forest-300',
                )}
              >
                <Upload size={14} aria-hidden />
                {t('settings.chooseBackupFile')}
                <input
                  id="backup-file"
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(event) => {
                    void readBackupFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
              {pendingImport ? (
                <Badge tone="slate">
                  {pendingImport.fileName}
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-500">{t('settings.importWarning')}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-ink-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-ink-800">{t('settings.backupsTitle')}</h3>
              <p className="mt-1 text-xs text-ink-500">{t('settings.backupsDesc')}</p>
            </div>
            <Button variant="outline" size="sm" icon={RotateCcw} onClick={() => void loadBackups()} loading={backupsLoading}>
              {t('common.refresh')}
            </Button>
          </div>
          {backupsError ? (
            <p className="mt-3 text-xs font-medium text-red-700" role="alert">
              {backupsError}
            </p>
          ) : null}
          {backups.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-ink-200 px-3 py-4 text-sm text-ink-500">
              {t('settings.noBackups')}
            </p>
          ) : (
            <div className="mt-3">
              <TableWrap>
                <TableHead>
                  <TableRow>
                    <TableTh>{t('settings.backupFile')}</TableTh>
                    <TableTh>{t('settings.backupDate')}</TableTh>
                    <TableTh>{t('settings.backupSize')}</TableTh>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.fileName}>
                      <TableTd className="break-all font-mono text-xs">{backup.fileName}</TableTd>
                      <TableTd className="whitespace-nowrap text-xs">
                        {formatDateTime(backup.createdAt, language)}
                      </TableTd>
                      <TableTd className="whitespace-nowrap text-xs">{backupLabel(backup.bytes)}</TableTd>
                    </TableRow>
                  ))}
                </TableBody>
              </TableWrap>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-100 bg-white p-3 text-xs leading-relaxed text-ink-600">
            <p className="font-semibold text-ink-800">{t('settings.manualBackupHint')}</p>
            <p className="mt-1 font-mono text-[11px] text-ink-500">{t('settings.dataDirNote')}</p>
          </div>
          <div className="rounded-lg border border-ink-100 bg-white p-3 text-xs leading-relaxed text-ink-600">
            <p className="font-semibold text-ink-800">{t('settings.seedNote')}</p>
            <p className="mt-1">{t('settings.languageNote')}</p>
          </div>
        </div>
      </Card>

      <Card className="mt-5 border-red-200">
        <CardHeader
          icon={ShieldAlert}
          title={t('settings.dangerZone')}
          subtitle={t('settings.resetDemoDesc')}
          action={<Badge tone="red">{t('common.critical')}</Badge>}
        />
        <AlertBanner tone="danger" title={t('settings.resetWarning')}>
          <p>{t('settings.importWarning')}</p>
        </AlertBanner>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-xs leading-relaxed text-ink-500">
            {t('settings.localOnlyNote')} {t('settings.manualBackupHint')}
          </p>
          <Button
            variant="danger"
            icon={RotateCcw}
            onClick={() => {
              setResetPhrase('');
              setResetError(null);
              setResetOpen(true);
            }}
          >
            {t('settings.resetDemo')}
          </Button>
        </div>
      </Card>

      <SeasonModal
        open={seasonOpen}
        season={editingSeason}
        onClose={() => setSeasonOpen(false)}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportPhrase('');
        }}
        onConfirm={() => void runImport()}
        title={t('settings.importConfirmTitle')}
        description={t('settings.importConfirmText')}
        confirmLabel={t('settings.importBackup')}
        tone="danger"
        loading={importing}
        confirmDisabled={importPhrase !== 'IMPORT_BACKUP'}
      >
        <div className="space-y-3">
          {pendingImport ? (
            <p className="rounded-lg border border-ink-100 bg-ink-50/60 px-3 py-2 text-xs">
              <span className="font-semibold">{t('common.file')}:</span> {pendingImport.fileName}
            </p>
          ) : null}
          <AlertBanner tone="warning" title={t('settings.importWarning')}>
            <p>{t('settings.downloadBackupDesc')}</p>
          </AlertBanner>
          <Field
            label={t('settings.importConfirmPhrase')}
            htmlFor="import-phrase"
            hint={t('settings.typeToConfirm')}
          >
            <Input
              id="import-phrase"
              value={importPhrase}
              autoComplete="off"
              onChange={(event) => setImportPhrase(event.target.value)}
              placeholder="IMPORT_BACKUP"
            />
          </Field>
          {importError ? (
            <p className="text-xs font-medium text-red-700" role="alert">
              {importError}
            </p>
          ) : null}
          <p className="text-[11px] text-ink-500">{t('settings.importDone')}</p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setResetPhrase('');
        }}
        onConfirm={() => void runReset()}
        title={t('settings.resetConfirmTitle')}
        description={t('settings.resetConfirmText')}
        confirmLabel={t('settings.resetDemo')}
        tone="danger"
        loading={resetting}
        confirmDisabled={resetPhrase !== 'RESET_DEMO'}
      >
        <div className="space-y-3">
          <Field
            label={t('settings.resetConfirmPhrase')}
            htmlFor="reset-phrase"
            hint={t('settings.typeToConfirm')}
          >
            <Input
              id="reset-phrase"
              value={resetPhrase}
              autoComplete="off"
              onChange={(event) => setResetPhrase(event.target.value)}
              placeholder="RESET_DEMO"
            />
          </Field>
          {resetError ? (
            <p className="text-xs font-medium text-red-700" role="alert">
              {resetError}
            </p>
          ) : null}
          <p className="text-[11px] text-ink-500">{t('settings.resetWarning')}</p>
        </div>
      </ConfirmDialog>

      <p className="mt-4 text-[11px] text-ink-400">
        {t('settings.dataDirNote')} · {isoDate()} · {t('app.version')} 1.0.0
      </p>
    </div>
  );
}
