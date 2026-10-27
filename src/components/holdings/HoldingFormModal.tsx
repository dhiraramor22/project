import { useEffect, useState } from 'react';
import { Sprout } from 'lucide-react';
import type { AgriculturalHolding, FarmerProfile } from '../../domain/types';
import type { HoldingInput } from '../../domain/schemas';
import { holdingSchema } from '../../domain/schemas';
import { translateServerError, translateValidationMessage, useI18n } from '../../i18n';
import { repository } from '../../repositories';
import { ApiRequestError } from '../../services/apiClient';
import { numberValue, useZodForm } from '../../utils/forms';
import { useToast } from '../ui/ToastProvider';
import {
  AlertBanner,
  Button,
  Field,
  Input,
  Modal,
  Select,
} from '../ui/primitives';

interface HoldingFormModalProps {
  open: boolean;
  holding?: AgriculturalHolding | null;
  farmers: FarmerProfile[];
  communes: string[];
  canChooseOwner: boolean;
  onClose: () => void;
  onSaved: (holding: AgriculturalHolding, warnings: string[]) => void | Promise<void>;
}

function defaultsFor(holding: AgriculturalHolding | null | undefined): HoldingInput {
  return {
    name: holding?.name ?? '',
    ownerFarmerId: holding?.ownerFarmerId ?? '',
    commune: holding?.commune ?? '',
    address: holding?.address ?? '',
    latitude: holding?.latitude,
    longitude: holding?.longitude,
    totalCultivatedAreaHa: holding?.totalCultivatedAreaHa ?? (undefined as unknown as number),
    status: holding?.status ?? 'ACTIVE',
  };
}

export function HoldingFormModal({
  open,
  holding,
  farmers,
  communes,
  canChooseOwner,
  onClose,
  onSaved,
}: HoldingFormModalProps) {
  const { t } = useI18n();
  const { notify } = useToast();
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(holding);

  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useZodForm<HoldingInput>(holdingSchema, defaultsFor(holding));

  useEffect(() => {
    if (open) {
      reset(defaultsFor(holding));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, holding?.id, reset]);

  const approvedFarmers = farmers.filter((farmer) => farmer.status === 'APPROVED');

  const submit = async (values: HoldingInput) => {
    setError(null);
    if (canChooseOwner && !isEdit && !values.ownerFarmerId) {
      setFieldError('ownerFarmerId', { message: 'validation.required' });
      return;
    }
    try {
      const result = holding
        ? await repository.updateHolding(holding.id, values)
        : await repository.createHolding(values);
      notify(holding ? t('holdings.updated') : t('holdings.created'));
      onClose();
      await onSaved(result.holding, result.warnings ?? []);
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
      title={holding ? t('holdings.edit') : t('holdings.add')}
      description={t('holdings.areaCheckNote')}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="holding-form" loading={isSubmitting} icon={Sprout}>
            {holding ? t('common.saveChanges') : t('common.create')}
          </Button>
        </>
      }
    >
      {error ? (
        <AlertBanner tone="danger" className="mb-4" title={t('common.error')}>
          {error}
        </AlertBanner>
      ) : null}

      <form id="holding-form" className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('field.holdingName')}
            htmlFor="h-name"
            required
            error={translateValidationMessage(t, errors.name?.message)}
          >
            <Input id="h-name" {...register('name')} />
          </Field>

          {canChooseOwner ? (
            <Field
              label={t('holdings.owner')}
              htmlFor="h-owner"
              required
              hint={isEdit ? t('error.ownerImmutable') : undefined}
              error={translateValidationMessage(
                t,
                errors.ownerFarmerId?.message,
              )}
            >
              <Select id="h-owner" disabled={isEdit} {...register('ownerFarmerId')}>
                <option value="">{t('holdings.selectOwner')}</option>
                {approvedFarmers.map((farmer) => (
                  <option key={farmer.id} value={farmer.id}>
                    {farmer.fullName} — {farmer.commune}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label={t('field.commune')} htmlFor="h-commune" required>
              <Select
                id="h-commune"
                {...register('commune')}
              >
                <option value="">{t('common.selectCommune')}</option>
                {communes.map((commune) => (
                  <option key={commune} value={commune}>
                    {commune}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {canChooseOwner ? (
            <Field
              label={t('field.commune')}
              htmlFor="h-commune"
              required
              error={translateValidationMessage(t, errors.commune?.message)}
            >
              <Select id="h-commune" {...register('commune')}>
                <option value="">{t('common.selectCommune')}</option>
                {communes.map((commune) => (
                  <option key={commune} value={commune}>
                    {commune}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field
            label={t('field.totalArea')}
            htmlFor="h-area"
            required
            hint={t('holdings.areaCheckNote')}
            error={translateValidationMessage(t, errors.totalCultivatedAreaHa?.message)}
          >
            <Input
              id="h-area"
              type="number"
              min="0"
              step="0.01"
              {...register('totalCultivatedAreaHa', numberValue)}
            />
          </Field>

          <Field
            label={t('field.address')}
            htmlFor="h-address"
            error={translateValidationMessage(t, errors.address?.message)}
          >
            <Input id="h-address" {...register('address')} />
          </Field>

          {isEdit ? (
            <Field label={t('field.status')} htmlFor="h-status">
              <Select id="h-status" {...register('status')}>
                <option value="ACTIVE">{t('status.ACTIVE')}</option>
                <option value="SUSPENDED">{t('status.SUSPENDED')}</option>
                <option value="ARCHIVED">{t('status.ARCHIVED')}</option>
              </Select>
            </Field>
          ) : null}

          <Field
            label={t('field.latitude')}
            htmlFor="h-lat"
            hint={t('holdings.coordinatesHint')}
            error={translateValidationMessage(t, errors.latitude?.message)}
          >
            <Input
              id="h-lat"
              type="number"
              step="0.00001"
              min="-90"
              max="90"
              {...register('latitude', numberValue)}
            />
          </Field>

          <Field
            label={t('field.longitude')}
            htmlFor="h-lng"
            error={translateValidationMessage(t, errors.longitude?.message)}
          >
            <Input
              id="h-lng"
              type="number"
              step="0.00001"
              min="-180"
              max="180"
              {...register('longitude', numberValue)}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
