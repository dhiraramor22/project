import { useEffect, useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import type { BootstrapPayload } from '../../domain/api';
import type { MovementInput } from '../../domain/schemas';
import { movementSchema } from '../../domain/schemas';
import { currentStock, convertQuantity, STOCK_UNITS } from '../../domain/inventory';
import { formatNumber, toDateInput } from '../../domain/format';
import type { InventoryMovement } from '../../domain/types';
import { translateServerError, translateValidationMessage, useI18n } from '../../i18n';
import { repository } from '../../repositories';
import { ApiRequestError } from '../../services/apiClient';
import { requiredNumberValue, useZodForm } from '../../utils/forms';
import { useToast } from '../ui/ToastProvider';
import {
  AlertBanner,
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from '../ui/primitives';

const MANUAL_TYPES: Array<MovementInput['type']> = ['OPENING_BALANCE', 'RECEIPT', 'ADJUSTMENT', 'RETURN'];

function defaultsFor(data: BootstrapPayload, defaults?: Partial<MovementInput>): MovementInput {
  return {
    holdingId: defaults?.holdingId ?? data.holdings[0]?.id ?? '',
    productId: defaults?.productId ?? data.pesticides.find((item) => !item.archived)?.id ?? '',
    type: defaults?.type ?? 'RECEIPT',
    occurredAt: defaults?.occurredAt ?? toDateInput(new Date().toISOString()),
    quantity: defaults?.quantity ?? (undefined as unknown as number),
    unit: defaults?.unit ?? 'L',
    adjustmentDirection: defaults?.adjustmentDirection,
    supplierOrReference: defaults?.supplierOrReference ?? '',
    notes: defaults?.notes ?? '',
  };
}

export function MovementFormModal({
  open,
  data,
  defaultHoldingId,
  defaultProductId,
  onClose,
  onSaved,
}: {
  open: boolean;
  data: BootstrapPayload;
  defaultHoldingId?: string;
  defaultProductId?: string;
  onClose: () => void;
  onSaved: (movement: InventoryMovement, warnings: string[]) => void | Promise<void>;
}) {
  const { t, language } = useI18n();
  const { notify } = useToast();
  const [error, setError] = useState<string | null>(null);
  const initial = defaultsFor(data, { holdingId: defaultHoldingId, productId: defaultProductId });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useZodForm<MovementInput>(movementSchema, initial);

  useEffect(() => {
    if (open) {
      reset(defaultsFor(data, { holdingId: defaultHoldingId, productId: defaultProductId }));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultHoldingId, defaultProductId, reset]);

  const holdingId = watch('holdingId');
  const productId = watch('productId');
  const type = watch('type');
  const unit = watch('unit');
  const quantity = watch('quantity');

  const products = useMemo(
    () => data.pesticides.filter((product) => !product.archived),
    [data.pesticides],
  );
  const product = products.find((item) => item.id === productId);
  const productUnit = product?.stockUnit ?? 'L';
  const available = product && holdingId
    ? currentStock(data.inventoryMovements, holdingId, productId, productUnit)
    : 0;

  const inProductUnit = product && Number.isFinite(quantity)
    ? convertQuantity(Number(quantity), unit, productUnit)
    : null;
  const isOutgoing = type === 'ADJUSTMENT' && watch('adjustmentDirection') === 'OUT';
  const insufficient = isOutgoing && inProductUnit !== null && inProductUnit > available;

  const onProductChange = (value: string) => {
    const next = data.pesticides.find((item) => item.id === value);
    if (next) setValue('unit', next.stockUnit, { shouldValidate: true });
  };

  const submit = async (values: MovementInput) => {
    setError(null);
    try {
      const result = await repository.createMovement(values);
      notify(t('inventory.created'));
      onClose();
      await onSaved(result.movement, result.warnings ?? []);
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
      title={t('inventory.recordTitle')}
      description={t('inventory.autoBalanceNote')}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="movement-form" loading={isSubmitting} icon={Boxes}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {error ? (
        <AlertBanner tone="danger" className="mb-4" title={t('common.error')}>
          {error}
        </AlertBanner>
      ) : null}

      <form id="movement-form" className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('field.holding')}
            htmlFor="mv-holding"
            required
            error={translateValidationMessage(t, errors.holdingId?.message)}
          >
            <Select id="mv-holding" {...register('holdingId')}>
              <option value="">{t('common.selectHolding')}</option>
              {data.holdings.map((holding) => (
                <option key={holding.id} value={holding.id}>
                  {holding.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t('field.product')}
            htmlFor="mv-product"
            required
            hint={t('inventory.consumptionNote')}
            error={translateValidationMessage(t, errors.productId?.message)}
          >
            <Select
              id="mv-product"
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
            label={t('inventory.movementType')}
            htmlFor="mv-type"
            required
            error={translateValidationMessage(t, errors.type?.message)}
          >
            <Select id="mv-type" {...register('type')}>
              {MANUAL_TYPES.map((item) => (
                <option key={item} value={item}>
                  {t(`movementType.${item}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t('field.occurredAt')}
            htmlFor="mv-date"
            required
            error={translateValidationMessage(t, errors.occurredAt?.message)}
          >
            <Input id="mv-date" type="date" {...register('occurredAt')} />
          </Field>

          {type === 'ADJUSTMENT' ? (
            <Field
              label={t('inventory.direction')}
              htmlFor="mv-direction"
              required
              error={translateValidationMessage(t, errors.adjustmentDirection?.message)}
            >
              <Select id="mv-direction" {...register('adjustmentDirection')}>
                <option value="IN">{t('inventory.directionIn')}</option>
                <option value="OUT">{t('inventory.directionOut')}</option>
              </Select>
            </Field>
          ) : null}

          <Field
            label={t('common.quantity')}
            htmlFor="mv-quantity"
            required
            hint={product ? t('inventory.unitHint', { unit: product.stockUnit }) : undefined}
            error={translateValidationMessage(t, errors.quantity?.message)}
          >
            <Input
              id="mv-quantity"
              type="number"
              min="0"
              step="0.0001"
              {...register('quantity', requiredNumberValue)}
            />
          </Field>

          <Field
            label={t('common.unit')}
            htmlFor="mv-unit"
            required
            error={translateValidationMessage(t, errors.unit?.message)}
          >
            <Select id="mv-unit" {...register('unit')}>
              {STOCK_UNITS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t('inventory.supplierRef')}
            htmlFor="mv-reference"
            error={translateValidationMessage(t, errors.supplierOrReference?.message)}
          >
            <Input id="mv-reference" {...register('supplierOrReference')} />
          </Field>

          <Field
            label={t('inventory.notes')}
            htmlFor="mv-notes"
            className="sm:col-span-2"
            error={translateValidationMessage(t, errors.notes?.message)}
          >
            <Textarea id="mv-notes" rows={3} {...register('notes')} />
          </Field>
        </div>

        <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3 text-sm text-ink-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{t('inventory.stockCheck')}</span>
            <span className="font-mono text-ink-900">
              {formatNumber(available, language)} {productUnit}
            </span>
          </div>
          {product ? (
            <p className="mt-1 text-xs text-ink-500">
              {t('inventory.unitHint', { unit: product.stockUnit })}
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-500">{t('inventory.selectProductFirst')}</p>
          )}
        </div>

        {insufficient ? (
          <AlertBanner tone="warning" title={t('inventory.insufficientStock')}>
            {t('inventory.insufficientStockText', {
              available: formatNumber(available, language),
              unit: productUnit,
            })}
          </AlertBanner>
        ) : null}

        <p className="text-xs text-ink-500">{t('inventory.negativeStockNote')}</p>
      </form>
    </Modal>
  );
}
