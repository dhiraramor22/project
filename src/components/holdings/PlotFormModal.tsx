import { useEffect, useState } from 'react';
import { Sprout } from 'lucide-react';
import type { Plot } from '../../domain/types';
import type { PlotInput } from '../../domain/schemas';
import { plotSchema } from '../../domain/schemas';
import { translateServerError, translateValidationMessage, useI18n } from '../../i18n';
import { repository } from '../../repositories';
import { ApiRequestError } from '../../services/apiClient';
import { numberValue, useZodForm } from '../../utils/forms';
import { useToast } from '../ui/ToastProvider';
import { AlertBanner, Button, Field, Input, Modal, Textarea } from '../ui/primitives';

function defaultsFor(plot?: Plot | null): PlotInput {
  return {
    name: plot?.name ?? '',
    areaHa: plot?.areaHa ?? (undefined as unknown as number),
    soilType: plot?.soilType ?? '',
    notes: plot?.notes ?? '',
  };
}

export function PlotFormModal({
  open,
  holdingId,
  plot,
  onClose,
  onSaved,
}: {
  open: boolean;
  holdingId: string;
  plot?: Plot | null;
  onClose: () => void;
  onSaved: (plot: Plot, warnings: string[]) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const { notify } = useToast();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useZodForm<PlotInput>(plotSchema, defaultsFor(plot));

  useEffect(() => {
    if (open) {
      reset(defaultsFor(plot));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plot?.id, reset]);

  const submit = async (values: PlotInput) => {
    setError(null);
    try {
      const result = plot
        ? await repository.updatePlot(plot.id, values)
        : await repository.createPlot({ ...values, holdingId });
      notify(plot ? t('holdings.plotUpdated') : t('holdings.plotCreated'));
      onClose();
      await onSaved(result.plot, result.warnings ?? []);
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
      title={plot ? t('holdings.editPlot') : t('holdings.addPlot')}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="plot-form" loading={isSubmitting} icon={Sprout}>
            {plot ? t('common.saveChanges') : t('common.create')}
          </Button>
        </>
      }
    >
      {error ? (
        <AlertBanner tone="danger" className="mb-4" title={t('common.error')}>
          {error}
        </AlertBanner>
      ) : null}
      <form id="plot-form" className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('holdings.plotName')} htmlFor="plot-name" required error={translateValidationMessage(t, errors.name?.message)}>
            <Input id="plot-name" {...register('name')} />
          </Field>
          <Field label={t('holdings.plotArea')} htmlFor="plot-area" required error={translateValidationMessage(t, errors.areaHa?.message)}>
            <Input id="plot-area" type="number" min="0" step="0.01" {...register('areaHa', numberValue)} />
          </Field>
          <Field label={t('holdings.soilType')} htmlFor="plot-soil" error={translateValidationMessage(t, errors.soilType?.message)}>
            <Input id="plot-soil" {...register('soilType')} />
          </Field>
          <Field label={t('holdings.plotNotes')} htmlFor="plot-notes" className="sm:col-span-2" error={translateValidationMessage(t, errors.notes?.message)}>
            <Textarea id="plot-notes" rows={3} {...register('notes')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
