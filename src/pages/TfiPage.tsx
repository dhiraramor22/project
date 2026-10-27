import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calculator,
  ChartNoAxesCombined,
  CircleHelp,
  Gauge,
  Save,
  Settings2,
  TriangleAlert,
} from 'lucide-react';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { statusTone, verificationTone } from '../app/status';
import { useAction } from '../app/useAction';
import {
  formatArea,
  formatDate,
  formatNumber,
} from '../domain/format';
import type { TFICalculationResult, TFIScopeType } from '../domain/types';
import { TFI_METHODOLOGY_VERSION } from '../domain/tfi';
import { translateServerError, useI18n } from '../i18n';
import { repository } from '../repositories';
import { ApiRequestError } from '../services/apiClient';
import { activeSeason } from '../utils/data';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  DemoBadge,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  TableBody,
  TableHead,
  TableRow,
  TableTd,
  TableTh,
  TableWrap,
  Textarea,
} from '../components/ui/primitives';

const SCOPES: TFIScopeType[] = ['CROP', 'PLOT', 'HOLDING', 'SEASON', 'TREATMENT', 'ALL'];

export function TfiPage() {
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { can, refresh } = useWorkspace();
  const { busy, error: actionError, run } = useAction();
  const [searchParams] = useSearchParams();
  const season = activeSeason(data);
  const prefillTreatment = searchParams.get('treatment');

  const [scopeType, setScopeType] = useState<TFIScopeType>(
    prefillTreatment ? 'TREATMENT' : 'CROP',
  );
  const [scopeId, setScopeId] = useState(prefillTreatment ?? '');
  const [seasonId, setSeasonId] = useState(season?.id ?? '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [result, setResult] = useState<TFICalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [normalization, setNormalization] = useState(data.tfiConfig.normalization);
  const [requireVerifiedDose, setRequireVerifiedDose] = useState(
    data.tfiConfig.requireVerifiedDose,
  );
  const [allowDemoReferenceDoses, setAllowDemoReferenceDoses] = useState(
    data.tfiConfig.allowDemoReferenceDoses,
  );
  const [configNotes, setConfigNotes] = useState(data.tfiConfig.notes ?? '');

  useEffect(() => {
    setNormalization(data.tfiConfig.normalization);
    setRequireVerifiedDose(data.tfiConfig.requireVerifiedDose);
    setAllowDemoReferenceDoses(data.tfiConfig.allowDemoReferenceDoses);
    setConfigNotes(data.tfiConfig.notes ?? '');
  }, [data.tfiConfig]);

  const crops = useMemo(
    () =>
      data.crops
        .filter((crop) => !seasonId || crop.seasonId === seasonId)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.crops, seasonId],
  );

  const scopeOptions = useMemo(() => {
    switch (scopeType) {
      case 'CROP':
        return crops.map((crop) => ({
          id: crop.id,
          label: `${crop.name} · ${formatArea(crop.areaHa, language)}`,
        }));
      case 'PLOT':
        return data.plots.map((plot) => {
          const holding = data.holdings.find((item) => item.id === plot.holdingId);
          return {
            id: plot.id,
            label: `${plot.name}${holding ? ` · ${holding.name}` : ''}`,
          };
        });
      case 'HOLDING':
        return data.holdings.map((holding) => ({
          id: holding.id,
          label: `${holding.name} · ${holding.commune}`,
        }));
      case 'SEASON':
        return data.seasons.map((item) => ({ id: item.id, label: item.label }));
      case 'TREATMENT':
        return data.treatments
          .filter((treatment) => treatment.status === 'ACTIVE')
          .slice()
          .sort((a, b) => b.treatmentDate.localeCompare(a.treatmentDate))
          .map((treatment) => {
            const crop = data.crops.find((item) => item.id === treatment.cropId);
            const product = data.pesticides.find((item) => item.id === treatment.productId);
            return {
              id: treatment.id,
              label: `${formatDate(treatment.treatmentDate, language)} · ${
                crop?.name ?? treatment.cropId
              } · ${product?.commercialName ?? treatment.productId}`,
            };
          });
      case 'ALL':
      default:
        return [];
    }
  }, [scopeType, crops, data, language]);

  const selectedCrop = data.crops.find((crop) => crop.id === scopeId);

  useEffect(() => {
    if (scopeType === 'SEASON') {
      setSeasonId(scopeId || season?.id || '');
    }
  }, [scopeType, scopeId, season?.id]);

  const calculate = async () => {
    setFormError(null);
    setCalcError(null);
    if (scopeType !== 'ALL' && !scopeId) {
      setFormError(t('tfi.selectRequired'));
      return;
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setFormError(t('error.invalidDateRange'));
      return;
    }
    setCalculating(true);
    try {
      const response = await repository.calculateTfi({
        scopeType,
        scopeId: scopeType === 'ALL' ? undefined : scopeId,
        seasonId:
          scopeType === 'SEASON'
            ? scopeId || seasonId || undefined
            : seasonId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setResult(response.result);
    } catch (caught) {
      setCalcError(
        caught instanceof ApiRequestError
          ? translateServerError(t, caught.code, caught.message)
          : t('error.generic'),
      );
    } finally {
      setCalculating(false);
    }
  };

  const updateConfig = async () => {
    await run(
      'tfi-config',
      () =>
        repository.updateTfiConfig({
          normalization,
          requireVerifiedDose,
          allowDemoReferenceDoses,
          notes: configNotes.trim() || undefined,
        }),
      {
        success: t('tfi.configSaved'),
        onSuccess: async () => {
          await refresh();
        },
      },
    );
  };

  const scopeLabel = (id: string) =>
    scopeOptions.find((option) => option.id === id)?.label ?? id;

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.section.operations')}
        title={t('tfi.title')}
        subtitle={t('tfi.subtitle')}
        actions={<DemoBadge />}
      />

      <AlertBanner tone="warning" className="mb-5" title={t('tfi.provisionalNotice')}>
        <p>{t('tfi.methodologyDisclaimer')}</p>
      </AlertBanner>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            icon={Calculator}
            title={t('tfi.calculateTitle')}
            subtitle={t('tfi.dateRange')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('tfi.scope')} htmlFor="tfi-scope" required>
              <Select
                id="tfi-scope"
                value={scopeType}
                onChange={(event) => {
                  setScopeType(event.target.value as TFIScopeType);
                  setScopeId('');
                  setResult(null);
                }}
              >
                {SCOPES.map((scope) => (
                  <option key={scope} value={scope}>
                    {t(`tfi.scope.${scope}`)}
                  </option>
                ))}
              </Select>
            </Field>

            {scopeType !== 'ALL' ? (
              <Field label={t('tfi.selectScope')} htmlFor="tfi-scope-id" required>
                <Select
                  id="tfi-scope-id"
                  value={scopeId}
                  onChange={(event) => {
                    setScopeId(event.target.value);
                    setResult(null);
                  }}
                >
                  <option value="">{t('common.selectPlaceholder')}</option>
                  {scopeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <div className="flex items-end">
                <p className="rounded-lg border border-ink-100 bg-ink-50/60 px-3 py-2 text-xs text-ink-600">
                  {t('tfi.allCropsNotice')}
                </p>
              </div>
            )}

            {scopeType !== 'SEASON' ? (
              <Field label={t('tfi.season')} htmlFor="tfi-season">
                <Select
                  id="tfi-season"
                  value={seasonId}
                  onChange={(event) => {
                    setSeasonId(event.target.value);
                    setResult(null);
                  }}
                >
                  <option value="">{t('common.allSeasons')}</option>
                  {data.seasons.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label={t('tfi.dateFrom')} htmlFor="tfi-from">
              <Input
                id="tfi-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </Field>
            <Field label={t('tfi.dateTo')} htmlFor="tfi-to">
              <Input
                id="tfi-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </Field>
          </div>

          {selectedCrop && scopeType === 'CROP' ? (
            <p className="mt-3 text-xs text-ink-500">
              {t('treatments.cropAreaAuto', {
                area: formatNumber(selectedCrop.areaHa, language, 2),
              })}
            </p>
          ) : null}

          {formError ? (
            <p className="mt-3 text-xs font-medium text-red-700" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button icon={Calculator} onClick={() => void calculate()} loading={calculating}>
              {t('tfi.calculate')}
            </Button>
            <span className="text-xs text-ink-500">{t('tfi.formulaNote')}</span>
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={CircleHelp}
            title={t('tfi.methodologyTitle')}
            subtitle={`${t('tfi.methodologyVersion')} · ${TFI_METHODOLOGY_VERSION}`}
          />
          <div className="space-y-3 text-xs leading-relaxed text-ink-600">
            <p>{t('tfi.methodologyFormula')}</p>
            <p>{t('tfi.methodologyAssumptions')}</p>
            <p>{t('tfi.methodologyDenominator')}</p>
            <p className="rounded-lg border border-clay-200 bg-clay-50/70 px-3 py-2 text-clay-900">
              {t('tfi.methodologyDisclaimer')}
            </p>
            <p>{t('tfi.aggregationNote')}</p>
          </div>
        </Card>
      </div>

      {calcError ? (
        <AlertBanner tone="danger" className="mt-5" title={t('common.error')}>
          {calcError}
        </AlertBanner>
      ) : null}

      <div className="mt-5">
        <Card>
          <CardHeader
            icon={ChartNoAxesCombined}
            title={t('tfi.result')}
            subtitle={
              result
                ? `${t(`tfi.scope.${result.scopeType}`)}${
                    result.scopeId ? ` · ${scopeLabel(result.scopeId)}` : ''
                  }`
                : t('tfi.selectScope')
            }
            action={result ? <Badge tone={statusTone(result.status)}>{t(`status.${result.status}`)}</Badge> : undefined}
          />
          {!result ? (
            <EmptyState
              icon={Gauge}
              title={t('tfi.emptyTitle')}
              description={t('tfi.emptyText')}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-clay-200 bg-clay-50/70 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-clay-900">
                    {t('tfi.value')}
                  </p>
                  <p className="mt-1 font-display text-3xl font-bold text-ink-900">
                    {formatNumber(result.value, language, 3)}
                  </p>
                  <p className="text-[11px] text-ink-500">{t('tfi.unit')}</p>
                </div>
                <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    {t('tfi.treatments')}
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-ink-900">
                    {formatNumber(result.treatmentCount, language, 0)}
                  </p>
                  <p className="text-[11px] text-ink-500">
                    {t('tfi.recordsUsed')}: {result.includedTreatments.length} ·{' '}
                    {t('tfi.recordsExcluded')}: {result.excludedTreatments.length}
                  </p>
                </div>
                <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    {t('tfi.denominator')}
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-ink-900">
                    {formatArea(result.denominatorAreaHa, language)}
                  </p>
                  <p className="text-[11px] text-ink-500">
                    {t(`tfi.config${result.configuration.normalization === 'CROP_AREA' ? 'CropArea' : 'TreatedArea'}`)}
                  </p>
                </div>
                <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    {t('tfi.normalization')}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink-900">
                    {t(`tfi.config${result.configuration.normalization === 'CROP_AREA' ? 'CropArea' : 'TreatedArea'}`)}
                  </p>
                  <p className="text-[11px] text-ink-500">
                    {t('tfi.methodologyVersion')}: {result.methodologyVersion}
                  </p>
                </div>
              </div>

              {result.status === 'INCOMPLETE' ? (
                <AlertBanner tone="warning" className="mt-4" title={t('tfi.incomplete')}>
                  {t('tfi.whyNotCalculated')}
                </AlertBanner>
              ) : null}

              {result.value === null && result.status !== 'EMPTY' ? (
                <AlertBanner tone="info" className="mt-4" title={t('tfi.noResult')}>
                  {result.denominatorAreaHa <= 0
                    ? t('tfi.denominatorZero')
                    : t('tfi.includeUnverifiedNote')}
                </AlertBanner>
              ) : null}

              <div className="mt-5">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-700">
                  {t('tfi.included')} ({result.includedTreatments.length})
                </h3>
                {result.includedTreatments.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
                    {t('tfi.emptyTitle')}
                  </p>
                ) : (
                  <TableWrap>
                    <TableHead>
                      <TableRow>
                        <TableTh>{t('treatments.table.date')}</TableTh>
                        <TableTh>{t('treatments.table.crop')}</TableTh>
                        <TableTh>{t('treatments.table.product')}</TableTh>
                        <TableTh>{t('tfi.treatedArea')}</TableTh>
                        <TableTh>{t('tfi.referenceDose')}</TableTh>
                        <TableTh>{t('tfi.doseRatio')}</TableTh>
                        <TableTh>{t('tfi.weightedIndex')}</TableTh>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.includedTreatments.map((contribution) => {
                        const treatment = data.treatments.find(
                          (item) => item.id === contribution.treatmentId,
                        );
                        const crop = data.crops.find((item) => item.id === contribution.cropId);
                        const product = data.pesticides.find(
                          (item) => item.id === contribution.productId,
                        );
                        return (
                          <TableRow key={contribution.treatmentId}>
                            <TableTd className="whitespace-nowrap text-xs">
                              {treatment ? (
                                <Link
                                  to={`/treatments/${treatment.id}`}
                                  className="font-semibold text-forest-800 hover:underline"
                                >
                                  {formatDate(treatment.treatmentDate, language)}
                                </Link>
                              ) : (
                                contribution.treatmentId
                              )}
                            </TableTd>
                            <TableTd className="text-xs">{crop?.name ?? contribution.cropId}</TableTd>
                            <TableTd className="text-xs">
                              {product?.commercialName ?? contribution.productId}
                              <span className="mt-1 block">
                                <Badge tone={verificationTone(contribution.referenceDoseStatus)}>
                                  {t(`status.${contribution.referenceDoseStatus}`)}
                                </Badge>
                              </span>
                            </TableTd>
                            <TableTd className="text-xs">
                              {formatArea(contribution.treatedAreaHa, language)}
                            </TableTd>
                            <TableTd className="font-mono text-xs">
                              {formatNumber(contribution.referenceDose, language, 4)}{' '}
                              {contribution.referenceDoseUnit}
                            </TableTd>
                            <TableTd className="font-mono text-xs">
                              {formatNumber(contribution.doseRatio, language, 3)}
                            </TableTd>
                            <TableTd className="font-mono text-xs font-semibold">
                              {formatNumber(contribution.weightedIndex, language, 4)}
                            </TableTd>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </TableWrap>
                )}
              </div>

              <div className="mt-5">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-700">
                  {t('tfi.excluded')} ({result.excludedTreatments.length})
                </h3>
                {result.excludedTreatments.length === 0 ? (
                  <p className="text-xs text-ink-500">{t('common.none')}</p>
                ) : (
                  <ul className="space-y-2">
                    {result.excludedTreatments.map((exclusion, index) => (
                      <li
                        key={`${exclusion.treatmentId}-${index}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2"
                      >
                        <span className="flex items-center gap-2 text-xs text-amber-900">
                          <TriangleAlert size={14} aria-hidden />
                          <Link
                            to={`/treatments/${exclusion.treatmentId}`}
                            className="font-mono font-semibold hover:underline"
                          >
                            {exclusion.treatmentId}
                          </Link>
                        </span>
                        <span className="text-xs font-semibold text-amber-900">
                          {t(`tfi.reason.${exclusion.reason}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
                {t('reports.generatedAt')}: {formatDate(result.calculatedAt, language)} ·{' '}
                {t('tfi.methodologyDisclaimer')}
              </p>
            </>
          )}
        </Card>
      </div>

      {can('settings:manage') ? (
        <Card className="mt-5">
          <CardHeader
            icon={Settings2}
            title={t('tfi.configTitle')}
            subtitle={t('tfi.configDescription')}
            action={<Badge tone="slate">{t('settings.currentVersion', { version: data.tfiConfig.version })}</Badge>}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label={t('tfi.configNormalization')} htmlFor="tfi-normalization">
              <Select
                id="tfi-normalization"
                value={normalization}
                onChange={(event) =>
                  setNormalization(event.target.value as 'CROP_AREA' | 'TREATED_AREA')
                }
              >
                <option value="CROP_AREA">{t('tfi.configCropArea')}</option>
                <option value="TREATED_AREA">{t('tfi.configTreatedArea')}</option>
              </Select>
            </Field>
            <Field label={t('tfi.configNotes')} htmlFor="tfi-config-notes">
              <Textarea
                id="tfi-config-notes"
                rows={2}
                value={configNotes}
                maxLength={500}
                onChange={(event) => setConfigNotes(event.target.value)}
              />
            </Field>
          </div>
          <div className="mt-4 space-y-3">
            <Checkbox
              label={t('tfi.configRequireVerified')}
              description={t('tfi.requireVerifiedHint')}
              checked={requireVerifiedDose}
              onChange={(event) => setRequireVerifiedDose(event.target.checked)}
            />
            <Checkbox
              label={t('tfi.configAllowDemo')}
              description={t('tfi.allowDemoHint')}
              checked={allowDemoReferenceDoses}
              onChange={(event) => setAllowDemoReferenceDoses(event.target.checked)}
            />
          </div>
          {actionError ? (
            <AlertBanner tone="danger" className="mt-4" title={t('common.error')}>
              {actionError}
            </AlertBanner>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-xs leading-relaxed text-ink-500">
              {t('tfi.includeUnverifiedNote')} {t('tfi.methodologyDisclaimer')}
            </p>
            <Button icon={Save} onClick={() => void updateConfig()} loading={busy === 'tfi-config'}>
              {t('common.saveChanges')}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
