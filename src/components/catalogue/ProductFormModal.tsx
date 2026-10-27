import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import type { PesticideProduct } from '../../domain/types';
import type { ProductFormState, ProductInput } from '../../domain/schemas';
import { productFormSchema, productSchema } from '../../domain/schemas';
import { translateServerError, translateValidationMessage, useI18n } from '../../i18n';
import { repository } from '../../repositories';
import { ApiRequestError } from '../../services/apiClient';
import { joinList, numberValue, splitList, useZodForm } from '../../utils/forms';
import { useToast } from '../ui/ToastProvider';
import {
  AlertBanner,
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from '../ui/primitives';

function defaultsFor(product?: PesticideProduct | null): ProductFormState {
  return {
    commercialName: product?.commercialName ?? '',
    activeIngredient: product?.activeIngredient ?? '',
    category: product?.category ?? '',
    formulation: product?.formulation ?? '',
    manufacturer: product?.manufacturer ?? '',
    registrationReference: product?.registrationReference ?? '',
    intendedCrops: joinList(product?.intendedCrops),
    targetPests: joinList(product?.targetPests),
    referenceDose: product?.referenceDose,
    referenceDoseUnit: product?.referenceDoseUnit,
    referenceSource: product?.referenceSource ?? '',
    safetyInfo: product?.safetyInfo ?? '',
    preHarvestIntervalDays: product?.preHarvestIntervalDays,
    reEntryIntervalHours: product?.reEntryIntervalHours,
    stockUnit: product?.stockUnit ?? 'L',
    lowStockThreshold: product?.lowStockThreshold ?? 0,
    verificationStatus: product?.verificationStatus ?? 'DEMO',
    archived: product?.archived ?? false,
  };
}

export function ProductFormModal({
  open,
  product,
  categories,
  communes,
  onClose,
  onSaved,
}: {
  open: boolean;
  product?: PesticideProduct | null;
  categories: string[];
  communes: string[];
  onClose: () => void;
  onSaved: (product: PesticideProduct) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const { notify } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [archive, setArchive] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useZodForm<ProductFormState>(productFormSchema, defaultsFor(product));

  useEffect(() => {
    if (open) {
      reset(defaultsFor(product));
      setError(null);
      setArchive(product?.archived ?? false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id, reset]);

  const verification = watch('verificationStatus');
  const stockUnit = watch('stockUnit');
  const volume = stockUnit === 'L' || stockUnit === 'mL';

  const submit = async (values: ProductFormState) => {
    setError(null);
    const intendedCrops = splitList(values.intendedCrops);
    const targetPests = splitList(values.targetPests);
    if (intendedCrops.length === 0) {
      setError(t('validation.atLeastOneCrop'));
      return;
    }
    if (targetPests.length === 0) {
      setError(t('validation.atLeastOneTarget'));
      return;
    }
    const candidate: ProductInput = {
      ...values,
      intendedCrops,
      targetPests,
      archived: archive,
    };
    const parsed = productSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(translateValidationMessage(t, parsed.error.issues[0]?.message));
      return;
    }
    try {
      const result = product
        ? await repository.updateProduct(product.id, parsed.data)
        : await repository.createProduct(parsed.data);
      notify(product ? t('catalogue.updated') : t('catalogue.created'));
      onClose();
      await onSaved(result.product);
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
      title={product ? t('catalogue.edit') : t('catalogue.add')}
      description={t('catalogue.demoNotice')}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="product-form" loading={isSubmitting} icon={FlaskConical}>
            {product ? t('common.saveChanges') : t('common.create')}
          </Button>
        </>
      }
    >
      {error ? (
        <AlertBanner tone="danger" className="mb-4" title={t('common.error')}>
          {error}
        </AlertBanner>
      ) : null}

      <form id="product-form" className="space-y-6" onSubmit={handleSubmit(submit)} noValidate>
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-700">
            {t('catalogue.identity')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('field.commercialName')}
              htmlFor="p-name"
              required
              error={translateValidationMessage(t, errors.commercialName?.message)}
            >
              <Input id="p-name" {...register('commercialName')} />
            </Field>
            <Field
              label={t('field.activeIngredient')}
              htmlFor="p-ingredient"
              required
              error={translateValidationMessage(t, errors.activeIngredient?.message)}
            >
              <Input id="p-ingredient" {...register('activeIngredient')} />
            </Field>
            <Field
              label={t('field.category')}
              htmlFor="p-category"
              required
              error={translateValidationMessage(t, errors.category?.message)}
            >
              <Select id="p-category" {...register('category')}>
                <option value="">{t('common.select')}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
                {communes.length === 0 ? null : null}
              </Select>
            </Field>
            <Field
              label={t('field.formulation')}
              htmlFor="p-formulation"
              required
              error={translateValidationMessage(t, errors.formulation?.message)}
            >
              <Input id="p-formulation" {...register('formulation')} />
            </Field>
            <Field
              label={t('field.manufacturer')}
              htmlFor="p-manufacturer"
              required
              error={translateValidationMessage(t, errors.manufacturer?.message)}
            >
              <Input id="p-manufacturer" {...register('manufacturer')} />
            </Field>
            <Field
              label={t('field.registrationReference')}
              htmlFor="p-registration"
              hint={t('catalogue.registrationRefHint')}
              error={translateValidationMessage(t, errors.registrationReference?.message)}
            >
              <Input id="p-registration" {...register('registrationReference')} />
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-700">
            {t('catalogue.reference')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('field.intendedCrops')}
              htmlFor="p-crops"
              required
              hint={t('catalogue.intendedCropsHint')}
              error={translateValidationMessage(t, errors.intendedCrops?.message)}
            >
              <Textarea id="p-crops" rows={2} {...register('intendedCrops')} />
            </Field>
            <Field
              label={t('field.targetPests')}
              htmlFor="p-targets"
              required
              hint={t('catalogue.targetPestsHint')}
              error={translateValidationMessage(t, errors.targetPests?.message)}
            >
              <Textarea id="p-targets" rows={2} {...register('targetPests')} />
            </Field>
            <Field
              label={t('field.referenceDose')}
              htmlFor="p-dose"
              hint={t('catalogue.referenceDoseHint')}
              error={translateValidationMessage(t, errors.referenceDose?.message)}
            >
              <Input id="p-dose" type="number" min="0" step="0.0001" {...register('referenceDose', numberValue)} />
            </Field>
            <Field
              label={t('field.referenceDoseUnit')}
              htmlFor="p-dose-unit"
              error={translateValidationMessage(t, errors.referenceDoseUnit?.message)}
            >
              <Select id="p-dose-unit" {...register('referenceDoseUnit')}>
                <option value="">{t('common.none')}</option>
                {volume ? (
                  <>
                    <option value="L/ha">L/ha</option>
                    <option value="mL/ha">mL/ha</option>
                  </>
                ) : (
                  <>
                    <option value="kg/ha">kg/ha</option>
                    <option value="g/ha">g/ha</option>
                  </>
                )}
              </Select>
            </Field>
            <Field
              label={t('field.referenceSource')}
              htmlFor="p-source"
              className="sm:col-span-2"
              hint={t('catalogue.sourceHint')}
              error={translateValidationMessage(t, errors.referenceSource?.message)}
            >
              <Input id="p-source" {...register('referenceSource')} />
            </Field>
            <Field
              label={t('catalogue.phi')}
              htmlFor="p-phi"
              hint={t('common.days')}
              error={translateValidationMessage(t, errors.preHarvestIntervalDays?.message)}
            >
              <Input id="p-phi" type="number" min="0" step="1" {...register('preHarvestIntervalDays', numberValue)} />
            </Field>
            <Field
              label={t('catalogue.rei')}
              htmlFor="p-rei"
              hint={t('common.hours')}
              error={translateValidationMessage(t, errors.reEntryIntervalHours?.message)}
            >
              <Input id="p-rei" type="number" min="0" step="1" {...register('reEntryIntervalHours', numberValue)} />
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-700">
            {t('catalogue.safety')}
          </h3>
          <Field
            label={t('field.safetyInfo')}
            htmlFor="p-safety"
            required
            error={translateValidationMessage(t, errors.safetyInfo?.message)}
          >
            <Textarea id="p-safety" rows={3} {...register('safetyInfo')} />
          </Field>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-700">
            {t('catalogue.stock')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('field.stockUnit')} htmlFor="p-stock-unit" hint={t('catalogue.unitHint')}>
              <Select id="p-stock-unit" {...register('stockUnit')}>
                <option value="L">L</option>
                <option value="mL">mL</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
              </Select>
            </Field>
            <Field
              label={t('field.lowStockThreshold')}
              htmlFor="p-threshold"
              hint={t('catalogue.lowStockHint')}
              error={translateValidationMessage(t, errors.lowStockThreshold?.message)}
            >
              <Input id="p-threshold" type="number" min="0" step="0.01" {...register('lowStockThreshold', numberValue)} />
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-700">
            {t('catalogue.verification')}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('field.verificationStatus')}
              htmlFor="p-verification"
              hint={t('catalogue.verificationHint')}
            >
              <Select id="p-verification" {...register('verificationStatus')}>
                <option value="DEMO">{t('verification.DEMO')}</option>
                <option value="UNVERIFIED">{t('verification.UNVERIFIED')}</option>
                <option value="VERIFIED">{t('verification.VERIFIED')}</option>
              </Select>
            </Field>
            {product ? (
              <div className="flex items-end pb-1">
                <Checkbox
                  id="p-archived"
                  label={t('field.archived')}
                  description={t('catalogue.archiveText')}
                  checked={archive}
                  onChange={(event) => setArchive(event.target.checked)}
                />
              </div>
            ) : null}
          </div>
          {verification === 'VERIFIED' ? (
            <AlertBanner tone="warning" className="mt-4" title={t('catalogue.verifiedNotice')}>
              {t('catalogue.verifiedRecordHint')}
            </AlertBanner>
          ) : (
            <AlertBanner tone="info" className="mt-4" title={t('catalogue.demoProductHint')}>
              {t('catalogue.referenceSectionNote')}
            </AlertBanner>
          )}
        </section>
      </form>
    </Modal>
  );
}
