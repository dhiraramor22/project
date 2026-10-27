import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ClipboardCheck, Eye, X } from 'lucide-react';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { statusTone } from '../app/status';
import { useAction } from '../app/useAction';
import { formatArea, formatDate } from '../domain/format';
import type { RegistrationRequest } from '../domain/types';
import { useI18n } from '../i18n';
import { repository } from '../repositories';
import { ReasonModal } from '../components/common/ReasonModal';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  KeyValue,
  Modal,
  PageHeader,
  Select,
  TableBody,
  TableHead,
  TableRow,
  TableTd,
  TableTh,
  TableWrap,
} from '../components/ui/primitives';

type ReviewMode = 'approve' | 'reject';

export function RegistrationsPage() {
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { refresh } = useWorkspace();
  const { busy, run } = useAction();
  const [status, setStatus] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<RegistrationRequest | null>(null);
  const [review, setReview] = useState<{ request: RegistrationRequest; mode: ReviewMode } | null>(null);

  const farmersById = useMemo(
    () => new Map(data.farmers.map((farmer) => [farmer.id, farmer])),
    [data.farmers],
  );

  const requests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.registrationRequests
      .filter((request) => status === 'all' || request.status === status)
      .filter((request) => {
        if (!term) return true;
        const farmer = farmersById.get(request.farmerId);
        return [farmer?.fullName, farmer?.commune, farmer?.email, request.id]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [data.registrationRequests, farmersById, search, status]);

  const pendingCount = data.registrationRequests.filter((request) => request.status === 'PENDING').length;

  const reviewRequest = review ? farmersById.get(review.request.farmerId) ?? null : null;

  const confirmReview = async (notes: string) => {
    if (!review) return;
    const mode = review.mode;
    await run(
      'review',
      () =>
        mode === 'approve'
          ? repository.approveRegistration(review.request.id, notes || undefined)
          : repository.rejectRegistration(review.request.id, notes || undefined),
      {
        success: mode === 'approve' ? t('registrations.approved') : t('registrations.rejected'),
        onSuccess: async () => {
          setReview(null);
          setDetail(null);
          await refresh();
        },
      },
    );
  };

  return (
    <div>
      <PageHeader
        title={t('registrations.title')}
        subtitle={t('registrations.subtitle')}
        eyebrow={t('nav.section.oversight')}
        actions={
          <Badge tone={pendingCount > 0 ? 'amber' : 'green'}>
            {t('registrations.pending', { count: pendingCount })}
          </Badge>
        }
      />

      <AlertBanner tone="info" className="mb-5">
        {t('registrations.approveText')}
      </AlertBanner>

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('registrations.statusFilter')} htmlFor="reg-status">
            <Select id="reg-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">{t('common.allStatuses')}</option>
              <option value="PENDING">{t('status.PENDING')}</option>
              <option value="APPROVED">{t('status.APPROVED')}</option>
              <option value="REJECTED">{t('status.REJECTED')}</option>
            </Select>
          </Field>
          <Field label={t('common.search')} htmlFor="reg-search">
            <input
              id="reg-search"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('farmers.searchPlaceholder')}
            />
          </Field>
        </div>
      </Card>

      {requests.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t('registrations.emptyTitle')}
          description={status === 'PENDING' ? t('registrations.emptyText') : t('registrations.noRequests')}
        />
      ) : (
        <TableWrap>
          <TableHead>
            <TableRow>
              <TableTh>{t('registrations.table.farmer')}</TableTh>
              <TableTh>{t('registrations.table.commune')}</TableTh>
              <TableTh>{t('registrations.table.submitted')}</TableTh>
              <TableTh>{t('registrations.table.source')}</TableTh>
              <TableTh>{t('registrations.table.status')}</TableTh>
              <TableTh>{t('registrations.table.reviewedBy')}</TableTh>
              <TableTh>{t('registrations.table.actions')}</TableTh>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((request) => {
              const farmer = farmersById.get(request.farmerId);
              return (
                <TableRow key={request.id}>
                  <TableTd>
                    <span className="block font-semibold text-ink-900">{farmer?.fullName ?? request.farmerId}</span>
                    <span className="block text-xs text-ink-500">{farmer?.email}</span>
                  </TableTd>
                  <TableTd>{farmer?.commune ?? '—'}</TableTd>
                  <TableTd className="whitespace-nowrap">{formatDate(request.submittedAt, language)}</TableTd>
                  <TableTd>
                    <Badge tone={request.source === 'SELF' ? 'sky' : 'slate'}>
                      {t(`status.${request.source}`)}
                    </Badge>
                  </TableTd>
                  <TableTd>
                    <Badge tone={statusTone(request.status)}>{t(`status.${request.status}`)}</Badge>
                  </TableTd>
                  <TableTd className="text-xs">{request.reviewedBy ?? '—'}</TableTd>
                  <TableTd>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" icon={Eye} onClick={() => setDetail(request)}>
                        {t('common.view')}
                      </Button>
                      {request.status === 'PENDING' ? (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            icon={Check}
                            onClick={() => setReview({ request, mode: 'approve' })}
                          >
                            {t('action.approve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            icon={X}
                            onClick={() => setReview({ request, mode: 'reject' })}
                          >
                            {t('action.reject')}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableTd>
                </TableRow>
              );
            })}
          </TableBody>
        </TableWrap>
      )}

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={t('registrations.details')}
        description={detail ? `${t('registrations.requestId')}: ${detail.id}` : undefined}
        size="lg"
        footer={
          detail?.status === 'PENDING' ? (
            <>
              <Button variant="outline" onClick={() => setDetail(null)}>
                {t('common.close')}
              </Button>
              <Button
                variant="danger"
                onClick={() => detail && setReview({ request: detail, mode: 'reject' })}
              >
                {t('action.reject')}
              </Button>
              <Button onClick={() => detail && setReview({ request: detail, mode: 'approve' })}>
                {t('registrations.approveConfirm')}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setDetail(null)}>
              {t('common.close')}
            </Button>
          )
        }
      >
        {detail ? (
          <RegistrationDetail request={detail} />
        ) : null}
      </Modal>

      <ReasonModal
        open={Boolean(review)}
        title={
          review?.mode === 'approve' ? t('registrations.approveTitle') : t('registrations.rejectTitle')
        }
        description={
          <>
            {review?.mode === 'approve' ? t('registrations.approveText') : t('registrations.rejectText')}
            {reviewRequest ? (
              <span className="mt-1 block font-semibold text-ink-700">
                {reviewRequest.fullName} · {reviewRequest.commune}
              </span>
            ) : null}
          </>
        }
        label={t('registrations.reviewNotes')}
        confirmLabel={
          review?.mode === 'approve' ? t('registrations.approveConfirm') : t('registrations.rejectConfirm')
        }
        tone={review?.mode === 'approve' ? 'primary' : 'danger'}
        requireReason={review?.mode === 'reject'}
        busy={busy === 'review'}
        onClose={() => setReview(null)}
        onConfirm={confirmReview}
      />
    </div>
  );
}

function RegistrationDetail({ request }: { request: RegistrationRequest }) {
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const farmer = data.farmers.find((item) => item.id === request.farmerId);

  if (!farmer) {
    return <p className="text-sm text-ink-500">{t('common.noData')}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(request.status)}>{t(`status.${request.status}`)}</Badge>
        <Badge tone={request.source === 'SELF' ? 'sky' : 'slate'}>{t(`status.${request.source}`)}</Badge>
        {request.status === 'PENDING' ? (
          <Badge tone="amber">{t('registrations.pendingBadge')}</Badge>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KeyValue label={t('field.fullName')}>{farmer.fullName}</KeyValue>
        <KeyValue label={t('field.email')}>{farmer.email}</KeyValue>
        <KeyValue label={t('field.phone')}>{farmer.phone}</KeyValue>
        <KeyValue label={t('field.commune')}>{farmer.commune}</KeyValue>
        <KeyValue label={t('registrations.area')}>
          {farmer.proposedAreaHa ? formatArea(farmer.proposedAreaHa, language) : t('common.notAvailable')}
        </KeyValue>
        <KeyValue label={t('field.submittedAt')}>{formatDate(request.submittedAt, language)}</KeyValue>
        <KeyValue label={t('field.source')}>{t(`status.${request.source}`)}</KeyValue>
        <KeyValue label={t('registrations.requestId')}>{request.id}</KeyValue>
        {request.reviewedAt ? (
          <KeyValue label={t('registrations.reviewedAt')}>
            {formatDate(request.reviewedAt, language)}
            {request.reviewedBy ? ` · ${request.reviewedBy}` : ''}
          </KeyValue>
        ) : null}
      </div>

      <div className="rounded-xl border border-ink-100 bg-sand-50/60 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-600">
          {t('registrations.holdingPreview')}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <KeyValue label={t('field.holdingName')}>
            {farmer.proposedHoldingName ?? t('registrations.noHoldingPreview')}
          </KeyValue>
          <KeyValue label={t('field.mainCrops')}>
            {farmer.mainCrops?.length ? farmer.mainCrops.join(', ') : '—'}
          </KeyValue>
          <KeyValue label={t('farmers.agriculturalId')}>{farmer.agriculturalId ?? '—'}</KeyValue>
          <KeyValue label={t('field.notes')}>{farmer.supportingInfo ?? '—'}</KeyValue>
        </div>
      </div>

      {request.reviewNotes ? (
        <AlertBanner tone="info" title={t('field.reviewNotes')}>
          {request.reviewNotes}
        </AlertBanner>
      ) : null}

      {request.status === 'PENDING' ? (
        <AlertBanner tone="warning" title={t('registrations.duplicateWarning')}>
          {t('auth.registration.pendingNote')}
        </AlertBanner>
      ) : null}

      {farmer.status === 'APPROVED' ? (
        <Link to={`/farmers/${farmer.id}`} className="text-sm font-semibold text-forest-700 hover:underline">
          {t('common.viewDetails')} →
        </Link>
      ) : null}
    </div>
  );
}
