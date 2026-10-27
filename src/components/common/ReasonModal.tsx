import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { Button, Field, Modal, Textarea } from '../ui/primitives';

export function ReasonModal({
  open,
  title,
  description,
  label,
  confirmLabel,
  tone = 'danger',
  busy = false,
  requireReason = true,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  label: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  requireReason?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);

  const invalid = requireReason ? reason.trim().length < 3 : false;

  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    await onConfirm(reason.trim());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={tone}
            onClick={() => void submit()}
            loading={busy}
            disabled={requireReason && !reason.trim()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field
        label={label}
        htmlFor="reason-modal-field"
        required={requireReason}
        error={
          touched && invalid
            ? t('validation.required')
            : undefined
        }
        hint={t('common.optionalInfo')}
      >
        <Textarea
          id="reason-modal-field"
          rows={4}
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => setTouched(true)}
        />
      </Field>
    </Modal>
  );
}
