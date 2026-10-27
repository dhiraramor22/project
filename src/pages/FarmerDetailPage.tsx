import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Sprout,
  UserRound,
} from 'lucide-react';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { statusTone } from '../app/status';
import { useAction } from '../app/useAction';
import { formatArea, formatDate, formatDateTime } from '../domain/format';
import { useI18n } from '../i18n';
import { repository } from '../repositories';
import { FarmerFormModal } from '../components/farmers/FarmerFormModal';
import { ForbiddenPage } from '../components/common/PageStates';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  KeyValue,
  PageHeader,
  TableBody,
  TableHead,
  TableRow,
  TableTd,
  TableTh,
  TableWrap,
} from '../components/ui/primitives';

export function FarmerDetailPage() {
  const { id } = useParams();
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { can, refresh } = useWorkspace();
  const { busy, error, run } = useAction();
  const [editOpen, setEditOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);

  const farmer = data.farmers.find((item) => item.id === id);
  const holdings = useMemo(
    () => data.holdings.filter((holding) => holding.ownerFarmerId === id),
    [data.holdings, id],
  );
  const crops = useMemo(
    () => data.crops.filter((crop) => crop.farmerId === id),
    [data.crops, id],
  );
  const registrations = useMemo(
    () => data.registrationRequests.filter((request) => request.farmerId === id),
    [data.registrationRequests, id],
  );

  if (!farmer) return <ForbiddenPage />;

  const suspend = async () => {
    await run('suspend', () => repository.suspendFarmer(farmer.id), {
      success: t('farmers.suspendSuccess'),
      onSuccess: async () => {
        setSuspendOpen(false);
        await refresh();
      },
    });
  };

  const reactivate = async () => {
    await run('reactivate', () => repository.reactivateFarmer(farmer.id), {
      success: t('farmers.reactivateSuccess'),
      onSuccess: refresh,
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow={t('farmers.detail.title')}
        title={farmer.fullName}
        subtitle={`${farmer.commune} · ${t(`status.${farmer.status}`)}`}
        actions={
          <>
            <Link to="/farmers">
              <Button variant="outline" icon={ArrowLeft} className="rtl:[&_svg]:rotate-180">
                {t('common.back')}
              </Button>
            </Link>
            {can('farmer:manage') ? (
              <Button variant="secondary" icon={Pencil} onClick={() => setEditOpen(true)}>
                {t('common.edit')}
              </Button>
            ) : null}
            {can('farmer:suspend') && farmer.status === 'APPROVED' ? (
              <Button variant="danger" icon={Ban} onClick={() => setSuspendOpen(true)} loading={busy === 'suspend'}>
                {t('action.suspend')}
              </Button>
            ) : null}
            {can('farmer:suspend') && farmer.status === 'SUSPENDED' ? (
              <Button icon={CheckCircle2} onClick={() => void reactivate()} loading={busy === 'reactivate'}>
                {t('action.reactivate')}
              </Button>
            ) : null}
          </>
        }
      />

      {error ? <AlertBanner tone="danger" className="mb-4">{error}</AlertBanner> : null}
      {farmer.status === 'PENDING' ? (
        <AlertBanner tone="warning" className="mb-4" title={t('status.PENDING')}>
          {t('farmers.pendingHint')}
        </AlertBanner>
      ) : null}
      {farmer.status === 'SUSPENDED' ? (
        <AlertBanner tone="warning" className="mb-4" title={t('status.SUSPENDED')}>
          {t('farmers.suspendedHint')}
        </AlertBanner>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={UserRound} title={t('farmers.detail.profile')} subtitle={farmer.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <KeyValue label={t('field.fullName')}>{farmer.fullName}</KeyValue>
            <KeyValue label={t('common.status')}>
              <Badge tone={statusTone(farmer.status)}>{t(`status.${farmer.status}`)}</Badge>
            </KeyValue>
            <KeyValue label={t('farmers.detail.contact')}>
              <span className="flex items-center gap-1.5">
                <Mail size={14} className="text-ink-400" aria-hidden /> {farmer.email}
              </span>
              <span className="mt-1 flex items-center gap-1.5">
                <Phone size={14} className="text-ink-400" aria-hidden /> {farmer.phone}
              </span>
            </KeyValue>
            <KeyValue label={t('field.commune')}>
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="text-ink-400" aria-hidden /> {farmer.commune}
              </span>
            </KeyValue>
            <KeyValue label={t('farmers.agriculturalId')}>{farmer.agriculturalId ?? '—'}</KeyValue>
            <KeyValue label={t('common.language')}>{t(`common.${farmer.preferredLanguage === 'en' ? 'english' : farmer.preferredLanguage === 'fr' ? 'french' : 'arabic'}`)}</KeyValue>
            <KeyValue label={t('common.createdAt')}>{formatDate(farmer.createdAt, language)}</KeyValue>
            <KeyValue label={t('common.updatedAt')}>{formatDateTime(farmer.updatedAt, language)}</KeyValue>
            {farmer.approvedAt ? (
              <KeyValue label={t('field.approvedAt')}>{formatDateTime(farmer.approvedAt, language)}</KeyValue>
            ) : null}
            {farmer.rejectionReason ? (
              <KeyValue label={t('field.reason')}>{farmer.rejectionReason}</KeyValue>
            ) : null}
            <KeyValue label={t('farmers.detail.adminNotes')} className="sm:col-span-2">
              {farmer.notes ?? '—'}
            </KeyValue>
          </div>
          {farmer.supportingInfo ? (
            <p className="mt-4 rounded-lg border border-ink-100 bg-sand-50/60 px-3 py-2 text-xs leading-relaxed text-ink-600">
              {farmer.supportingInfo}
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader icon={Sprout} title={t('dashboard.scope')} />
          <div className="space-y-4">
            <KeyValue label={t('farmers.table.holdings')}>{holdings.length}</KeyValue>
            <KeyValue label={t('dashboard.cultivatedArea')}>
              {formatArea(
                holdings.reduce((sum, holding) => sum + holding.totalCultivatedAreaHa, 0),
                language,
              )}
            </KeyValue>
            <KeyValue label={t('farmers.detail.crops')}>{crops.length}</KeyValue>
            <KeyValue label={t('farmers.detail.registrations')}>{registrations.length}</KeyValue>
            {farmer.userId ? (
              <KeyValue label={t('common.account')}>{t('farmers.accountInvited')}</KeyValue>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          icon={Sprout}
          title={t('farmers.detail.holdings')}
          action={
            <Link to={`/holdings?farmer=${farmer.id}`} className="text-xs font-semibold text-forest-700 hover:underline">
              {t('common.viewAll')}
            </Link>
          }
        />
        {holdings.length === 0 ? (
          <EmptyState compact icon={Sprout} title={t('holdings.emptyTitle')} description={t('farmers.noHoldingsForFarmer')} />
        ) : (
          <TableWrap>
            <TableHead>
              <TableRow>
                <TableTh>{t('field.holdingName')}</TableTh>
                <TableTh>{t('field.commune')}</TableTh>
                <TableTh>{t('common.area')}</TableTh>
                <TableTh>{t('holdings.plots')}</TableTh>
                <TableTh>{t('holdings.crops')}</TableTh>
                <TableTh>{t('common.status')}</TableTh>
              </TableRow>
            </TableHead>
            <TableBody>
              {holdings.map((holding) => (
                <TableRow key={holding.id}>
                  <TableTd>
                    <Link to={`/holdings/${holding.id}`} className="font-semibold text-forest-800 hover:underline">
                      {holding.name}
                    </Link>
                  </TableTd>
                  <TableTd>{holding.commune}</TableTd>
                  <TableTd>{formatArea(holding.totalCultivatedAreaHa, language)}</TableTd>
                  <TableTd>{data.plots.filter((plot) => plot.holdingId === holding.id).length}</TableTd>
                  <TableTd>{data.crops.filter((crop) => crop.holdingId === holding.id).length}</TableTd>
                  <TableTd>
                    <Badge tone={statusTone(holding.status)}>{t(`status.${holding.status}`)}</Badge>
                  </TableTd>
                </TableRow>
              ))}
            </TableBody>
          </TableWrap>
        )}
      </Card>

      <Card className="mt-5">
        <CardHeader icon={UserRound} title={t('farmers.detail.registrations')} />
        {registrations.length === 0 ? (
          <p className="py-4 text-sm text-ink-500">{t('registrations.noRequests')}</p>
        ) : (
          <ul className="space-y-2">
            {registrations.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2">
                <span className="text-xs text-ink-600">
                  {request.id} · {formatDate(request.submittedAt, language)}
                </span>
                <Badge tone={statusTone(request.status)}>{t(`status.${request.status}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <FarmerFormModal
        mode="edit"
        open={editOpen}
        farmer={farmer}
        communes={data.settings.communes}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          await refresh();
        }}
      />

      <ConfirmDialog
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        onConfirm={() => void suspend()}
        title={t('farmers.suspendTitle')}
        description={t('farmers.suspendText')}
        confirmLabel={t('action.suspend')}
        tone="danger"
        loading={busy === 'suspend'}
      />
    </div>
  );
}
