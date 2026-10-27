import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calculator, Save, SprayCan, TriangleAlert } from 'lucide-react';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { useAction } from '../app/useAction';
import {
  currentStock,
  quantityFromDose,
  STOCK_UNITS,
  suggestedStockUnitForDoseUnit,
} from '../domain/inventory';
import { formatNumber, toDateInput } from '../domain/format';
import type { TreatmentInput } from '../domain/schemas';
import { treatmentSchema } from '../domain/schemas';
import type {
  AgriculturalSeason,
  CropRecord,
  Plot,
  TreatmentRecord,
} from '../domain/types';
import { translateValidationMessage, useI18n } from '../i18n';
import { repository } from '../repositories';
import { activeSeason } from '../utils/data';
import { requiredNumberValue, useZodForm } from '../utils/forms';
import { useToast } from '../components/ui/ToastProvider';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
  DemoBadge,
} from '../components/ui/primitives';
import { verificationTone } from '../app/status';

function firstId<T extends { id: string }>(items: T[]): string {
  return items[0]?.id ?? '';
}

function cropForPlot(
  crops: CropRecord[],
  holdingId: string,
  plotId: string,
  seasonId: string,
): CropRecord | undefined {
  return (
    crops.find(
      (crop) =>
        crop.holdingId === holdingId &&
        crop.plotId === plotId &&
        (!seasonId || crop.seasonId === seasonId),
    ) ?? crops.find((crop) => crop.holdingId === holdingId && crop.plotId === plotId)
  );
}

function defaultsFor(
  holdings: { id: string }[],
  plots: Plot[],
  crops: CropRecord[],
  season: AgriculturalSeason | undefined,
  treatment?: TreatmentRecord,
): TreatmentInput {
  const holdingId = treatment?.holdingId ?? firstId(holdings);
  const plot =
    plots.find((item) => item.id === treatment?.plotId) ??
    plots.find((item) => item.holdingId === holdingId);
  const crop =
    crops.find((item) => item.id === treatment?.cropId) ??
    cropForPlot(crops, holdingId, plot?.id ?? '', season?.id ?? '');

  return {
    holdingId,
    plotId: treatment?.plotId ?? plot?.id ?? '',
    cropId: treatment?.cropId ?? crop?.id ?? '',
    seasonId: treatment?.seasonId ?? season?.id ?? '',
    treatmentDate: treatment?.treatmentDate ?? toDateInput(new Date().toISOString()),
    productId: treatment?.productId ?? '',
    target: treatment?.target ?? '',
    treatedAreaHa: treatment?.treatedAreaHa ?? (undefined as unknown as number),
    totalCropAreaHa: treatment?.totalCropAreaHa ?? crop?.areaHa ?? (undefined as unknown as number),
    appliedDose: treatment?.appliedDose ?? (undefined as unknown as number),
    appliedDoseUnit: treatment?.appliedDoseUnit ?? 'L/ha',
    quantityApplied: treatment?.quantityApplied ?? (undefined as unknown as number),
    quantityUnit: treatment?.quantityUnit ?? 'L',
    applicationMethod: treatment?.applicationMethod ?? '',
    fieldConditions: treatment?.fieldConditions ?? '',
    notes: treatment?.notes ?? '',
    sourceInfo: treatment?.sourceInfo ?? '',
  };
}

export function TreatmentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { can, refresh } = useWorkspace();
  const { notify } = useToast();
  const { busy, error, run } = useAction();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const existing = data.treatments.find((treatment) => treatment.id === id);
  const isEdit = Boolean(id);
  const season = activeSeason(data);
  const fallbackDefaults = defaultsFor(data.holdings, data.plots, data.crops, season, existing);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useZodForm<TreatmentInput>(treatmentSchema, fallbackDefaults);

  const holdingId = watch('holdingId');
  const plotId = watch('plotId');
  const cropId = watch('cropId');
  const seasonId = watch('seasonId');
  const productId = watch('productId');
  const appliedDose = watch('appliedDose');
  const appliedDoseUnit = watch('appliedDoseUnit');
  const treatedAreaHa = watch('treatedAreaHa');
  const quantityUnit = watch('quantityUnit');

  const product = data.pesticides.find((item) => item.id === productId);
  const selectedCrop = data.crops.find((crop) => crop.id === cropId);
  const plots = useMemo(
    () => data.plots.filter((plot) => plot.holdingId === holdingId),
    [data.plots, holdingId],
  );
  const crops = useMemo(
    () =>
      data.crops.filter(
        (crop) =>
          crop.holdingId === holdingId &&
          crop.plotId === plotId &&
          (!seasonId || crop.seasonId === seasonId),
      ),
    [data.crops, holdingId, plotId, seasonId],
  );
  const products = useMemo(
    () => data.pesticides.filter((item) => !item.archived),
    [data.pesticides],
  );

  const available = product && holdingId
    ? currentStock(data.inventoryMovements, holdingId, product.id, product.stockUnit)
    : 0;
  const calculated = quantityFromDose(
    Number(appliedDose),
    appliedDoseUnit,
    Number(treatedAreaHa),
  );
  const doseFamilyVolume = appliedDoseUnit === 'L/ha' || appliedDoseUnit === 'mL/ha';
  const productFamilyVolume = product?.stockUnit === 'L' || product?.stockUnit === 'mL';

  if (isEdit && !existing) {
    return (
      <div>
        <PageHeader title={t('treatments.editTitle')} />
        <AlertBanner tone="danger">{t('error.notFound')}</AlertBanner>
      </div>
    );
  }

  if (!can('treatment:write')) {
    return (
      <div>
        <PageHeader title={t('treatments.newTitle')} />
        <AlertBanner tone="danger">{t('error.forbidden')}</AlertBanner>
      </div>
    );
  }

  if (existing?.status === 'REVERSED') {
    return (
      <div>
        <PageHeader title={t('treatments.editTitle')} />
        <AlertBanner tone="warning" className="mb-4" title={t('treatments.reversedNotice')}>
          {t('treatments.correctionWorkflowText')}
        </AlertBanner>
        <Link to={`/treatments/${existing.id}`}>
          <Button variant="outline" icon={ArrowLeft}>{t('common.back')}</Button>
        </Link>
      </div>
    );
  }

  const onHoldingChange = (nextHoldingId: string) => {
    const nextPlot = data.plots.find((plot) => plot.holdingId === nextHoldingId);
    const nextCrop = cropForPlot(data.crops, nextHoldingId, nextPlot?.id ?? '', seasonId);
    setValue('plotId', nextPlot?.id ?? '', { shouldValidate: true });
    setValue('cropId', nextCrop?.id ?? '', { shouldValidate: true });
    setValue('totalCropAreaHa', nextCrop?.areaHa ?? (undefined as unknown as number));
  };

  const onPlotChange = (nextPlotId: string) => {
    const nextCrop = cropForPlot(data.crops, holdingId, nextPlotId, seasonId);
    setValue('cropId', nextCrop?.id ?? '', { shouldValidate: true });
    setValue('totalCropAreaHa', nextCrop?.areaHa ?? (undefined as unknown as number));
  };

  const onCropChange = (nextCropId: string) => {
    const crop = data.crops.find((item) => item.id === nextCropId);
    if (crop) {
      setValue('seasonId', crop.seasonId, { shouldValidate: true });
      setValue('totalCropAreaHa', crop.areaHa, { shouldValidate: true });
    }
  };

  const onProductChange = (nextProductId: string) => {
    const next = data.pesticides.find((item) => item.id === nextProductId);
    if (!next) return;
    setValue('quantityUnit', next.stockUnit, { shouldValidate: true });
    if (next.referenceDoseUnit) {
      setValue('appliedDoseUnit', next.referenceDoseUnit, { shouldValidate: true });
    }
    if (!watch('target') && next.targetPests[0]) {
      setValue('target', next.targetPests[0], { shouldValidate: true });
    }
  };

  const applyCalculated = () => {
    if (!calculated) return;
    setValue('quantityApplied', calculated.quantity, { shouldValidate: true });
    setValue('quantityUnit', calculated.unit, { shouldValidate: true });
  };

  const submit = async (values: TreatmentInput) => {
    setFormError(null);
    await run(
      isEdit ? 'update-treatment' : 'create-treatment',
      () =>
        existing
          ? repository.updateTreatment(existing.id, values)
          : repository.createTreatment(values),
      {
        success: isEdit ? t('treatments.updateSuccess') : t('treatments.createSuccess'),
        onSuccess: async (result) => {
          setWarnings(result.warnings ?? []);
          await refresh();
          navigate(`/treatments/${result.treatment.id}`);
        },
      },
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.treatments')}
        title={isEdit ? t('treatments.editTitle') : t('treatments.newTitle')}
        subtitle={t('treatments.subtitle')}
        actions={
          <>
            <Link to={existing ? `/treatments/${existing.id}` : '/treatments'}>
              <Button variant="outline" icon={ArrowLeft} className="rtl:[&_svg]:rotate-180">
                {t('common.back')}
              </Button>
            </Link>
            <DemoBadge />
          </>
        }
      />

      {formError || error ? (
        <AlertBanner tone="danger" className="mb-4" title={t('common.error')}>
          {formError ?? error}
        </AlertBanner>
      ) : null}
      {warnings.length > 0 ? (
        <AlertBanner tone="warning" className="mb-4" title={t('holdings.warningTitle')}>
          <ul className="list-inside list-disc space-y-1">
            {warnings.map((warning) => (
              <li key={warning}>{t(`warning.${warning}`)}</li>
            ))}
          </ul>
        </AlertBanner>
      ) : null}

      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
        <Card>
          <CardHeader icon={SprayCan} title={t('treatments.cropSelection')} subtitle={t('treatments.selectCropFirst')} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label={t('field.holding')}
              htmlFor="tr-holding"
              required
              error={translateValidationMessage(t, errors.holdingId?.message)}
            >
              <Select
                id="tr-holding"
                {...register('holdingId', {
                  onChange: (event) => onHoldingChange(event.target.value),
                })}
              >
                <option value="">{t('common.selectHolding')}</option>
                {data.holdings.map((holding) => (
                  <option key={holding.id} value={holding.id}>
                    {holding.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('field.plot')}
              htmlFor="tr-plot"
              required
              error={translateValidationMessage(t, errors.plotId?.message)}
            >
              <Select
                id="tr-plot"
                {...register('plotId', {
                  onChange: (event) => onPlotChange(event.target.value),
                })}
              >
                <option value="">{t('common.selectPlot')}</option>
                {plots.map((plot) => (
                  <option key={plot.id} value={plot.id}>
                    {plot.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('field.crop')}
              htmlFor="tr-crop"
              required
              error={translateValidationMessage(t, errors.cropId?.message)}
            >
              <Select
                id="tr-crop"
                {...register('cropId', {
                  onChange: (event) => onCropChange(event.target.value),
                })}
              >
                <option value="">{t('common.selectCrop')}</option>
                {crops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.name} · {crop.areaHa} ha
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('field.season')}
              htmlFor="tr-season"
              required
              error={translateValidationMessage(t, errors.seasonId?.message)}
            >
              <Select
                id="tr-season"
                {...register('seasonId', {
                  onChange: (event) => {
                    const nextCrop = cropForPlot(data.crops, holdingId, plotId, event.target.value);
                    setValue('cropId', nextCrop?.id ?? '', { shouldValidate: true });
                    setValue('totalCropAreaHa', nextCrop?.areaHa ?? (undefined as unknown as number));
                  },
                })}
              >
                <option value="">{t('common.selectSeason')}</option>
                {data.seasons.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {selectedCrop ? (
            <p className="mt-3 text-xs text-ink-500">
              {t('treatments.cropAreaAuto', {
                area: formatNumber(selectedCrop.areaHa, language, 2),
              })}
              {selectedCrop.plotId ? ` · ${plots.find((plot) => plot.id === selectedCrop.plotId)?.name ?? ''}` : ''}
            </p>
          ) : (
            <p className="mt-3 text-xs text-ink-500">{t('treatments.noSeasonCrop')}</p>
          )}
        </Card>

        <Card>
          <CardHeader icon={SprayCan} title={t('treatments.applicationDetails')} subtitle={t('treatments.referenceMethodology')} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label={t('treatments.treatmentDate')}
              htmlFor="tr-date"
              required
              error={translateValidationMessage(t, errors.treatmentDate?.message)}
            >
              <Input id="tr-date" type="date" {...register('treatmentDate')} />
            </Field>

            <Field
              label={t('treatments.product')}
              htmlFor="tr-product"
              required
              hint={product ? `${product.activeIngredient} · ${product.stockUnit}` : t('treatments.productFirst')}
              error={translateValidationMessage(t, errors.productId?.message)}
            >
              <Select
                id="tr-product"
                {...register('productId', {
                  onChange: (event) => onProductChange(event.target.value),
                })}
              >
                <option value="">{t('common.selectProduct')}</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.commercialName} ({item.stockUnit})
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('treatments.target')}
              htmlFor="tr-target"
              required
              error={translateValidationMessage(t, errors.target?.message)}
            >
              <Input
                id="tr-target"
                placeholder={t('treatments.targetPlaceholder')}
                {...register('target')}
              />
            </Field>

            <Field
              label={t('treatments.treatedArea')}
              htmlFor="tr-treated-area"
              required
              error={translateValidationMessage(t, errors.treatedAreaHa?.message)}
            >
              <Input
                id="tr-treated-area"
                type="number"
                min="0"
                step="0.01"
                {...register('treatedAreaHa', requiredNumberValue)}
              />
            </Field>

            <Field
              label={t('treatments.totalCropArea')}
              htmlFor="tr-total-area"
              required
              hint={t('treatments.totalAreaHint')}
              error={translateValidationMessage(t, errors.totalCropAreaHa?.message)}
            >
              <Input
                id="tr-total-area"
                type="number"
                min="0"
                step="0.01"
                {...register('totalCropAreaHa', requiredNumberValue)}
              />
            </Field>

            <Field
              label={t('treatments.appliedDose')}
              htmlFor="tr-dose"
              required
              error={translateValidationMessage(t, errors.appliedDose?.message)}
            >
              <Input
                id="tr-dose"
                type="number"
                min="0"
                step="0.0001"
                {...register('appliedDose', requiredNumberValue)}
              />
            </Field>

            <Field
              label={t('treatments.appliedDoseUnit')}
              htmlFor="tr-dose-unit"
              required
              error={translateValidationMessage(t, errors.appliedDoseUnit?.message)}
            >
              <Select id="tr-dose-unit" {...register('appliedDoseUnit')}>
                {(doseFamilyVolume ? ['L/ha', 'mL/ha'] : ['kg/ha', 'g/ha']).map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('treatments.quantityApplied')}
              htmlFor="tr-quantity"
              required
              hint={calculated ? t('treatments.calculatedQuantity', { quantity: formatNumber(calculated.quantity, language, 3), unit: calculated.unit }) : t('treatments.doseRatioHint')}
              error={translateValidationMessage(t, errors.quantityApplied?.message)}
            >
              <Input
                id="tr-quantity"
                type="number"
                min="0"
                step="0.0001"
                {...register('quantityApplied', requiredNumberValue)}
              />
            </Field>

            <Field
              label={t('treatments.quantityUnit')}
              htmlFor="tr-quantity-unit"
              required
              error={translateValidationMessage(t, errors.quantityUnit?.message)}
            >
              <Select id="tr-quantity-unit" {...register('quantityUnit')}>
                {STOCK_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={Calculator}
              onClick={applyCalculated}
              disabled={!calculated}
            >
              {t('treatments.useCalculated')}
            </Button>
            {product ? (
              <span className="text-xs text-ink-500">{t('treatments.stockUnit', { unit: product.stockUnit })}</span>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader icon={TriangleAlert} title={t('treatments.referenceAndStock')} subtitle={t('treatments.referenceMethodology')} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {t('treatments.referenceDose')}
              </p>
              {product?.referenceDose !== undefined && product.referenceDoseUnit ? (
                <p className="mt-1 font-mono text-base font-semibold text-ink-900">
                  {formatNumber(product.referenceDose, language, 4)} {product.referenceDoseUnit}
                </p>
              ) : (
                <p className="mt-1 text-ink-600">{t('treatments.referenceDoseMissing')}</p>
              )}
              {product ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={verificationTone(product.verificationStatus)}>
                    {t(`verification.${product.verificationStatus}`)}
                  </Badge>
                  {product.referenceSource ? (
                    <span className="text-xs text-ink-500">{product.referenceSource}</span>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-2 text-xs text-ink-500">{t('treatments.referenceDoseDemo')}</p>
            </div>

            <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {t('treatments.inventoryCheck')}
              </p>
              <p className="mt-1 font-mono text-base font-semibold text-ink-900">
                {formatNumber(available, language)} {product?.stockUnit ?? '—'}
              </p>
              <p className="mt-1 text-xs text-ink-500">{t('treatments.availableStock', { quantity: formatNumber(available, language), unit: product?.stockUnit ?? '' })}</p>
              {Number(watch('quantityApplied')) > available ? (
                <Badge tone="amber" className="mt-2">
                  {t('treatments.insufficientStock')}
                </Badge>
              ) : null}
              {product && doseFamilyVolume !== productFamilyVolume ? (
                <p className="mt-2 text-xs font-medium text-red-700">{t('treatments.unitFamilyMismatch')}</p>
              ) : null}
            </div>
          </div>
          {product && product.referenceDose === undefined ? (
            <AlertBanner tone="warning" className="mt-4" title={t('treatments.referenceDoseMissing')}>
              {t('treatments.referenceDoseMissing')}
            </AlertBanner>
          ) : null}
        </Card>

        <Card>
          <CardHeader icon={SprayCan} title={t('treatments.additionalInfo')} subtitle={t('common.optionalInfo')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('treatments.method')} htmlFor="tr-method" error={translateValidationMessage(t, errors.applicationMethod?.message)}>
              <Input id="tr-method" placeholder={t('treatments.methodPlaceholder')} {...register('applicationMethod')} />
            </Field>
            <Field label={t('treatments.conditions')} htmlFor="tr-conditions" error={translateValidationMessage(t, errors.fieldConditions?.message)}>
              <Input id="tr-conditions" placeholder={t('treatments.conditionsPlaceholder')} {...register('fieldConditions')} />
            </Field>
            <Field label={t('treatments.notes')} htmlFor="tr-notes" className="sm:col-span-2" error={translateValidationMessage(t, errors.notes?.message)}>
              <Textarea id="tr-notes" rows={3} placeholder={t('treatments.notesPlaceholder')} {...register('notes')} />
            </Field>
            <Field label={t('treatments.sourceInfo')} htmlFor="tr-source" className="sm:col-span-2" error={translateValidationMessage(t, errors.sourceInfo?.message)}>
              <Input id="tr-source" placeholder={t('treatments.sourcePlaceholder')} {...register('sourceInfo')} />
            </Field>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-4 shadow-card">
          <p className="max-w-2xl text-xs leading-relaxed text-ink-500">
            {isEdit ? t('treatments.editNote') : t('treatments.consumptionHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to={existing ? `/treatments/${existing.id}` : '/treatments'}>
              <Button variant="outline" type="button">
                {t('common.cancel')}
              </Button>
            </Link>
            <Button type="submit" icon={Save} loading={isSubmitting || busy === 'create-treatment' || busy === 'update-treatment'}>
              {isEdit ? t('common.saveChanges') : t('treatments.new')}
            </Button>
          </div>
        </div>
      </form>

      <p className="mt-4 text-xs text-ink-500">{t('treatments.editNote')}</p>
    </div>
  );
}
