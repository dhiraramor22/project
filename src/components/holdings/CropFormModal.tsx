import { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';
import type { AgriculturalSeason, CropRecord, Plot } from '../../domain/types';
import type { CropInput } from '../../domain/schemas';
import { cropSchema } from '../../domain/schemas';
import { translateServerError, translateValidationMessage, useI18n } from '../../i18n';
import { repository } from '../../repositories';
import { ApiRequestError } from '../../services/apiClient';
import { numberValue, useZodForm } from '../../utils/forms';
import { useToast } from '../ui/ToastProvider';
import { AlertBanner, Button, Field, Input, Modal, Select, Textarea } from '../ui/primitives';

function defaultsFor(
  crop: CropRecord | null | undefined,
  plots: Plot[],
  seasons: AgriculturalSeason[],
  defaultSeasonId?: string,
): CropInput {
  return {
    plotId: crop?.plotId ?? plots[0]?.id ?? '',
    seasonId: crop?.seasonId ?? defaultSeasonId ?? seasons[0]?.id ?? '',
    name: crop?.name ?? '',
    category: crop?.category ?? '',
    areaHa: crop?.areaHa ?? (undefined as unknown as number),
    plantingDate: crop?.plantingDate ?? '',
    harvestDate: crop?.harvestDate ?? '',
    notes: crop?.notes ?? '',
  };
}

export function CropFormModal({
  open,
  crop,
  plots,
  seasons,
  categories,
  suggestions,
  defaultSeasonId,
  onClose,
  onSaved,
}: {
  open: boolean;
  crop?: CropRecord | null;
  plots: Plot[];
  seasons: AgriculturalSeason[];
  categories: string[];
  suggestions: string[];
  defaultSeasonId?: string;
  onClose: () => void;
  onSaved: (crop: CropRecord, warnings: string[]) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const { notify } = useToast();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useZodForm<CropInput>(cropSchema, defaultsFor(crop, plots, seasons, defaultSeasonId));

  useEffect(() => {
    if (open) {
      reset(defaultsFor(crop, plots, seasons, defaultSeasonId));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, crop?.id, reset]);

  const submit = async (values: CropInput) => {
    setError(null);
    try {
      const result = crop
        ? await repository.updateCrop(crop.id, values)
        : await repository.createCrop(values);
      notify(crop ? t('holdings.cropUpdated') : t('holdings.cropCreated'));
      onClose();
      await onSaved(result.crop, result.warnings ?? []);
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
      title={crop ? t('holdings.editCrop') : t('holdings.addCrop')}
      description={t('holdings.cropSeasonHint')}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="crop-form" loading={isSubmitting} icon={Leaf}>
            {crop ? t('common.saveChanges') : t('common.create')}
          </Button>
        </>
      }
    >
      {error ? (
        <AlertBanner tone="danger" className="mb-4" title={t('common.error')}>
          {error}
        </AlertBanner>
      ) : null}
      <form id="crop-form" className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('field.plot')} htmlFor="crop-plot" required hint={t('holdings.cropPlotHint')} error={translateValidationMessage(t, errors.plotId?.message)}>
            <Select id="crop-plot" {...register('plotId')}>
              <option value="">{t('common.selectPlot')}</option>
              {plots.map((plot) => (
                <option key={plot.id} value={plot.id}>
                  {plot.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('field.season')} htmlFor="crop-season" required error={translateValidationMessage(t, errors.seasonId?.message)}>
            <Select id="crop-season" {...register('seasonId')}>
              <option value="">{t('common.selectSeason')}</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('holdings.cropName')} htmlFor="crop-name" required error={translateValidationMessage(t, errors.name?.message)}>
            <Input id="crop-name" list="crop-suggestions" {...register('name')} />
            <datalist id="crop-suggestions">
              {suggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </Field>
          <Field label={t('holdings.cropCategory')} htmlFor="crop-category" required error={translateValidationMessage(t, errors.category?.message)}>
            <Select id="crop-category" {...register('category')}>
              <option value="">{t('common.select')}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('holdings.cropArea')} htmlFor="crop-area" required error={translateValidationMessage(t, errors.areaHa?.message)}>
            <Input id="crop-area" type="number" min="0" step="0.01" {...register('areaHa', numberValue)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('holdings.plantingDate')} htmlFor="crop-planting" error={translateValidationMessage(t, errors.plantingDate?.message)}>
              <Input id="crop-planting" type="date" {...register('plantingDate')} />
            </Field>
            <Field label={t('holdings.harvestDate')} htmlFor="crop-harvest" error={translateValidationMessage(t, errors.harvestDate?.message)}>
              <Input id="crop-harvest" type="date" {...register('harvestDate')} />
            </Field>
          </div>
          <Field label={t('common.notes')} htmlFor="crop-notes" className="sm:col-span-2" error={translateValidationMessage(t, errors.notes?.message)}>
            <Textarea id="crop-notes" rows={3} {...register('notes')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
