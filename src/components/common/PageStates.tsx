import { Link } from 'react-router-dom';
import { ArrowLeft, LockKeyhole, MapPinned } from 'lucide-react';
import { useI18n } from '../../i18n';
import { Button, Card } from '../ui/primitives';

export function ForbiddenPage() {
  const { t } = useI18n();
  return (
    <Card className="mx-auto max-w-2xl">
      <div className="flex flex-col items-center py-8 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <LockKeyhole size={26} aria-hidden />
        </span>
        <h1 className="font-display text-2xl font-bold text-ink-900">{t('common.forbiddenTitle')}</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-500">{t('common.forbiddenText')}</p>
        <Link to="/" className="mt-6">
          <Button icon={ArrowLeft} className="rtl:[&_svg]:rotate-180">
            {t('common.goDashboard')}
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <Card className="mx-auto max-w-2xl">
      <div className="flex flex-col items-center py-8 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-600">
          <MapPinned size={26} aria-hidden />
        </span>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest-600">404</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink-900">{t('common.pageNotFound')}</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-500">{t('common.pageNotFoundText')}</p>
        <Link to="/" className="mt-6">
          <Button icon={ArrowLeft} className="rtl:[&_svg]:rotate-180">
            {t('common.goDashboard')}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
