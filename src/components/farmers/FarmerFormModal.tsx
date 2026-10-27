import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { FarmerProfile } from '../../domain/types';
import type { FarmerAdminInput, RegistrationFormState } from '../../domain/schemas';
import {
  farmerAdminUpdateSchema,
  registrationSchema,
} from '../../domain/schemas';
import { translateServerError, translateValidationMessage, useI18n } from '../../i18n';
import { repository } from '../../repositories';
import { useToast } from '../ui/ToastProvider';
import { ApiRequestError } from '../../services/apiClient';
import { numberValue, useZodForm } from '../../utils/forms';
import {
  AlertBanner,
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from '../ui/primitives';

const CREATE_DEFAULTS: RegistrationFormState = {
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

interface CreateProps {
  mode: 'create';
  open: boolean;
  communes: string[];
  onClose: () => void;
  onSaved: (farmer: FarmerProfile) => void | Promise<void>;
}

interface EditProps {
  mode: 'edit';
  open: boolean;
  farmer: FarmerProfile;
  communes: string[];
  onClose: () => void;
  onSaved: (farmer: FarmerProfile) => void | Promise<void>;
}

export function FarmerFormModal(props: CreateProps | EditProps) {
  return props.mode === 'create' ? <CreateFarmerModal {...props} /> : <EditFarmerModal {...props} />;
}

function CreateFarmerModal({ open, communes, onClose, onSaved }: CreateProps) {
  const { t } = useI18n();
  const { notify } = useToast();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useZodForm<RegistrationFormState>(registrationSchema, CREATE_DEFAULTS);

  useEffect(() => {
    if (open) {
      reset(CREATE_DEFAULTS);
      setError(null);
    }
  }, [open, reset]);

  const submit = async (values: RegistrationFormState) => {
    setError(null);
    try {
      const created = await repository.createFarmer({ ...values, consent: true });
      notify(t('farmers.createdSuccess'));
      onClose();
      await onSaved(created.farmer);
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
      title={t('farmers.detail.createTitle')}
      description={t('farmers.detail.invitationNote')}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-farmer-form" loading={isSubmitting} icon={UserPlus}>
            {t('farmers.add')}
          </Button>
        </>
      }
    >
      {error ? (
        <AlertBanner tone="danger" className="mb-4" title={t('common.error')}>
          {error}
        </AlertBanner>
      ) : null}
      <form id="create-farmer-form" className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('field.fullName')} htmlFor="cf-name" required error={translateValidationMessage(t, errors.fullName?.message)}>
            <Input id="cf-name" {...register('fullName')} />
          </Field>
          <Field label={t('field.email')} htmlFor="cf-email" required error={translateValidationMessage(t, errors.email?.message)}>
            <Input id="cf-email" type="email" {...register('email')} />
          </Field>
          <Field label={t('field.phone')} htmlFor="cf-phone" required error={translateValidationMessage(t, errors.phone?.message)}>
            <Input id="cf-phone" type="tel" {...register('phone')} />
          </Field>
          <Field label={t('field.language')} htmlFor="cf-language" error={translateValidationMessage(t, errors.preferredLanguage?.message)}>
            <Select id="cf-language" {...register('preferredLanguage')}>
              <option value="en">{t('common.english')}</option>
              <option value="fr">{t('common.french')}</option>
              <option value="ar">{t('common.arabic')}</option>
            </Select>
          </Field>
          <Field label={t('field.holdingName')} htmlFor="cf-holding" required hint={t('auth.registration.holdingHint')} error={translateValidationMessage(t, errors.holdingName?.message)}>
            <Input id="cf-holding" {...register('holdingName')} />
          </Field>
          <Field label={t('field.commune')} htmlFor="cf-commune" required error={translateValidationMessage(t, errors.commune?.message)}>
            <Select id="cf-commune" {...register('commune')}>
              <option value="">{t('common.selectCommune')}</option>
              {communes.map((commune) => (
                <option key={commune} value={commune}>
                  {commune}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('field.cultivatedArea')} htmlFor="cf-area" required hint={t('auth.registration.areaHint')} error={translateValidationMessage(t, errors.cultivatedAreaHa?.message)}>
            <Input id="cf-area" type="number" min="0" step="0.01" {...register('cultivatedAreaHa', numberValue)} />
          </Field>
          <Field label={t('field.mainCrops')} htmlFor="cf-crops" required hint={t('auth.registration.cropsHint')} error={translateValidationMessage(t, errors.mainCrops?.message)}>
            <Input id="cf-crops" {...register('mainCrops')} />
          </Field>
          <Field label={t('farmers.agriculturalId')} htmlFor="cf-agri" error={translateValidationMessage(t, errors.agriculturalId?.message)}>
            <Input id="cf-agri" {...register('agriculturalId')} />
          </Field>
          <Field label={t('common.notes')} htmlFor="cf-support" className="sm:col-span-2" error={translateValidationMessage(t, errors.supportingInfo?.message)}>
            <Textarea id="cf-support" rows={3} {...register('supportingInfo')} />
          </Field>
        </div>
        <p className="rounded-lg border border-ink-100 bg-ink-50/70 px-3 py-2 text-xs leading-relaxed text-ink-500">
          {t('farmers.accountInvited')}
        </p>
      </form>
    </Modal>
  );
}

function EditFarmerModal({ open, farmer, communes, onClose, onSaved }: EditProps) {
  const { t } = useI18n();
  const { notify } = useToast();
  const [error, setError] = useState<string | null>(null);

  const defaults: FarmerAdminInput = {
    fullName: farmer.fullName,
    email: farmer.email,
    phone: farmer.phone,
    preferredLanguage: farmer.preferredLanguage,
    agriculturalId: farmer.agriculturalId ?? '',
    supportingInfo: farmer.supportingInfo ?? '',
    commune: farmer.commune,
    status: farmer.status,
    notes: farmer.notes ?? '',
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useZodForm<FarmerAdminInput>(farmerAdminUpdateSchema, defaults);

  useEffect(() => {
    if (open) {
      reset(defaults);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, farmer.id, reset]);

  const submit = async (values: FarmerAdminInput) => {
    setError(null);
    try {
      const updated = await repository.updateFarmer(farmer.id, values);
      notify(t('farmers.updatedSuccess'));
      onClose();
      await onSaved(updated);
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
      title={t('farmers.detail.editTitle')}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="edit-farmer-form" loading={isSubmitting}>
            {t('common.saveChanges')}
          </Button>
        </>
      }
    >
      {error ? (
        <AlertBanner tone="danger" className="mb-4" title={t('common.error')}>
          {error}
        </AlertBanner>
      ) : null}
      <form id="edit-farmer-form" className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('field.fullName')} htmlFor="ef-name" required error={translateValidationMessage(t, errors.fullName?.message)}>
            <Input id="ef-name" {...register('fullName')} />
          </Field>
          <Field label={t('field.email')} htmlFor="ef-email" required error={translateValidationMessage(t, errors.email?.message)}>
            <Input id="ef-email" type="email" {...register('email')} />
          </Field>
          <Field label={t('field.phone')} htmlFor="ef-phone" required error={translateValidationMessage(t, errors.phone?.message)}>
            <Input id="ef-phone" type="tel" {...register('phone')} />
          </Field>
          <Field label={t('field.language')} htmlFor="ef-language">
            <Select id="ef-language" {...register('preferredLanguage')}>
              <option value="en">{t('common.english')}</option>
              <option value="fr">{t('common.french')}</option>
              <option value="ar">{t('common.arabic')}</option>
            </Select>
          </Field>
          <Field label={t('field.commune')} htmlFor="ef-commune" required error={translateValidationMessage(t, errors.commune?.message)}>
            <Select id="ef-commune" {...register('commune')}>
              {communes.map((commune) => (
                <option key={commune} value={commune}>
                  {commune}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('field.status')} htmlFor="ef-status">
            <Select id="ef-status" {...register('status')}>
              <option value="PENDING">{t('status.PENDING')}</option>
              <option value="APPROVED">{t('status.APPROVED')}</option>
              <option value="REJECTED">{t('status.REJECTED')}</option>
              <option value="SUSPENDED">{t('status.SUSPENDED')}</option>
            </Select>
          </Field>
          <Field label={t('farmers.agriculturalId')} htmlFor="ef-agri" error={translateValidationMessage(t, errors.agriculturalId?.message)}>
            <Input id="ef-agri" {...register('agriculturalId')} />
          </Field>
          <Field label={t('farmers.detail.adminNotes')} htmlFor="ef-notes" className="sm:col-span-2" error={translateValidationMessage(t, errors.notes?.message)}>
            <Textarea id="ef-notes" rows={3} {...register('notes')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
