import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  Edit3,
  Gauge,
  History,
  Printer,
  RotateCcw,
  SprayCan,
  TriangleAlert,
} from 'lucide-react';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { alertDescription, alertTitle, severityTone, statusTone, verificationTone } from '../app/status';
import { useAction } from '../app/useAction';
import {
  formatArea,
  formatDate,
  formatDateTime,
  formatNumber,
  isoDate,
} from '../domain/format';
import { calculateTFI } from '../domain/tfi';
import { useI18n } from '../i18n';
import { repository } from '../repositories';
import { printTable } from '../utils/export';
import {
  cropsById,
  farmersById,
  holdingsById,
  plotsById,
  productsById,
  seasonsById,
} from '../utils/data';
import { ForbiddenPage } from '../components/common/PageStates';
import { ReasonModal } from '../components/common/ReasonModal';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  DemoBadge,
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

export function TreatmentDetailPage() {
  const { id } = useParams();
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { can, refresh } = useWorkspace();
  const { busy, error, run } = useAction();
  const [reverseOpen, setReverseOpen] = useState(false);

  const treatment = data.treatments.find((item) => item.id === id);
  const cropMap = useMemo(() => cropsById(data), [data]);
  const productMap = useMemo(() => productsById(data), [data]);
  const holdingMap = useMemo(() => holdingsById(data), [data]);
  const plotMap = useMemo(() => plotsById(data), [data]);
  const farmerMap = useMemo(() => farmersById(data), [data]);
  const seasonMap = useMemo(() => seasonsById(data), [data]);

  if (!treatment) return <ForbiddenPage />;

  const crop = cropMap.get(treatment.cropId);
  const product = productMap.get(treatment.productId);
  const holding = holdingMap.get(treatment.holdingId);
  const plot = plotMap.get(treatment.plotId);
  const season = seasonMap.get(treatment.seasonId);
  const consumption = data.inventoryMovements.find(
    (movement) => movement.id === treatment.consumptionMovementId,
  );
  const relatedAlerts = data.alerts.filter(
    (alert) => alert.entityId === treatment.id && !alert.resolved,
  );
  const history = data.auditLog
    .filter(
      (event) =>
        event.entityId === treatment.id ||
        (consumption && event.entityId === consumption.id),
    )
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const tfi = useMemo(
    () =>
      calculateTFI({
        treatments: [treatment],
        crops: data.crops,
        plots: data.plots,
        holdings: data.holdings,
        config: data.tfiConfig,
        scopeType: 'TREATMENT',
        scopeId: treatment.id,
      }),
    [data.crops, data.holdings, data.plots, data.tfiConfig, treatment],
  );
  const contribution = tfi.includedTreatments[0];
  const exclusion = tfi.excludedTreatments[0];

  const areaExceeded = treatment.treatedAreaHa > treatment.totalCropAreaHa + 0.0001;
  const canWrite = can('treatment:write') && treatment.status === 'ACTIVE';
  const canReverse = can('treatment:reverse') && treatment.status === 'ACTIVE';

  const reverse = async (reason: string) => {
    await run('reverse-treatment', () => repository.reverseTreatment(treatment.id, reason), {
      success: t('treatments.reverseSuccess'),
      onSuccess: async () => {
        setReverseOpen(false);
        await refresh();
      },
    });
  };

  const printRecord = () => {
    const rows: Array<[string, string]> = [
      [t('common.id'), treatment.id],
      [t('common.status'), t(`status.${treatment.status}`)],
      [t('treatments.treatmentDate'), formatDate(treatment.treatmentDate, language)],
      [t('field.farmer'), farmerMap.get(treatment.farmerId) ?? treatment.farmerId],
      [t('field.holding'), holding?.name ?? treatment.holdingId],
      [t('field.plot'), plot?.name ?? treatment.plotId],
      [t('field.crop'), crop?.name ?? treatment.cropId],
      [t('field.season'), season?.label ?? treatment.seasonId],
      [t('field.product'), product?.commercialName ?? treatment.productId],
      [t('field.activeIngredient'), treatment.activeIngredientSnapshot],
      [t('field.target'), treatment.target],
      [t('treatments.treatedArea'), formatArea(treatment.treatedAreaHa, language)],
      [t('treatments.totalCropArea'), formatArea(treatment.totalCropAreaHa, language)],
      [
        t('treatments.appliedDose'),
        `${formatNumber(treatment.appliedDose, language, 4)} ${treatment.appliedDoseUnit}`,
      ],
      [
        t('treatments.quantityApplied'),
        `${formatNumber(treatment.quantityApplied, language, 4)} ${treatment.quantityUnit}`,
      ],
      [
        t('field.referenceDose'),
        treatment.referenceDose !== undefined && treatment.referenceDoseUnit
          ? `${formatNumber(treatment.referenceDose, language, 4)} ${treatment.referenceDoseUnit}`
          : t('common.notAvailable'),
      ],
      [t('field.referenceDoseStatus'), t(`status.${treatment.referenceDoseStatus}`)],
      [t('treatments.referenceSource'), treatment.referenceSource ?? '—'],
      [t('treatments.method'), treatment.applicationMethod ?? '—'],
      [t('treatments.conditions'), treatment.fieldConditions ?? '—'],
      [t('treatments.notes'), treatment.notes ?? '—'],
      [t('treatments.sourceInfo'), treatment.sourceInfo ?? '—'],
      [t('field.revision'), String(treatment.revision)],
      [t('common.createdAt'), formatDateTime(treatment.createdAt, language)],
    ];
    if (treatment.reversedAt) {
      rows.push([t('treatments.reversedBy'), treatment.reversedBy ?? '—']);
      rows.push([t('treatments.reversalReason'), treatment.reversalReason ?? '—']);
    }
    const opened = printTable({
      title: t('treatments.detailTitle'),
      subtitle: product?.commercialName ?? treatment.productId,
      meta: [
        `${t('app.institution')} · ${t('app.demoData')}`,
        `${t('reports.generatedAt')}: ${formatDate(isoDate(), language)}`,
        `${t('tfi.provisionalBadge')} · demo-1.0`,
      ],
      headers: [t('common.name'), t('common.details')],
      rows,
      notice: t('app.prototypeNotice'),
      direction: language === 'ar' ? 'rtl' : 'ltr',
      language,
    });
    if (!opened) window.alert(t('map.loadFailed'));
  };

  return (
    <div>
      <PageHeader
        eyebrow={t('treatments.detail')}
        title={t('treatments.detailTitle')}
        subtitle={`${treatment.id} · ${formatDate(treatment.treatmentDate, language)}`}
        actions={
          <>
            <Link to="/treatments">
              <Button variant="outline" icon={ArrowLeft} className="rtl:[&_svg]:rotate-180">
                {t('treatments.backToRegister')}
              </Button>
            </Link>
            <Button variant="outline" icon={Printer} onClick={printRecord}>
              {t('common.print')}
            </Button>
            {canWrite ? (
              <Link to={`/treatments/${treatment.id}/edit`}>
                <Button variant="secondary" icon={Edit3}>
                  {t('common.edit')}
                </Button>
              </Link>
            ) : null}
            {canReverse ? (
              <Button variant="danger" icon={RotateCcw} onClick={() => setReverseOpen(true)}>
                {t('treatments.reverseTitle')}
              </Button>
            ) : null}
            <DemoBadge />
          </>
        }
      />

      {error ? (
        <AlertBanner tone="danger" className="mb-4" title={t('common.error')}>
          {error}
        </AlertBanner>
      ) : null}

      {treatment.status === 'REVERSED' ? (
        <AlertBanner tone="warning" className="mb-4" title={t('treatments.reversedNotice')}>
          <p>{treatment.reversalReason ?? t('treatments.reverseText')}</p>
          {treatment.reversedAt ? (
            <p className="mt-1 text-xs">
              {formatDateTime(treatment.reversedAt, language)}
              {treatment.reversedBy ? ` · ${treatment.reversedBy}` : ''}
            </p>
          ) : null}
        </AlertBanner>
      ) : null}

      {areaExceeded ? (
        <AlertBanner tone="warning" className="mb-4" title={t('alerts.areaMismatch.title')}>
          {t('alerts.areaMismatch.description', {
            treated: formatNumber(treatment.treatedAreaHa, language, 2),
            total: formatNumber(treatment.totalCropAreaHa, language, 2),
          })}
        </AlertBanner>
      ) : null}

      {treatment.referenceDoseStatus !== 'VERIFIED' ? (
        <AlertBanner tone="info" className="mb-4" title={t('treatments.referenceDoseDemo')}>
          {t('treatments.referenceMethodology')}
        </AlertBanner>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            icon={SprayCan}
            title={t('treatments.detailTitle')}
            subtitle={crop?.name ?? treatment.cropId}
            action={<Badge tone={statusTone(treatment.status)}>{t(`status.${treatment.status}`)}</Badge>}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KeyValue label={t('treatments.treatmentDate')}>
              {formatDate(treatment.treatmentDate, language)}
            </KeyValue>
            <KeyValue label={t('field.farmer')}>
              {treatment.farmerId === data.farmerId ? (
                farmerMap.get(treatment.farmerId) ?? treatment.farmerId
              ) : (
                <Link
                  to={`/farmers/${treatment.farmerId}`}
                  className="font-semibold text-forest-800 hover:underline"
                >
                  {farmerMap.get(treatment.farmerId) ?? treatment.farmerId}
                </Link>
              )}
            </KeyValue>
            <KeyValue label={t('field.holding')}>
              <Link
                to={`/holdings/${treatment.holdingId}`}
                className="font-semibold text-forest-800 hover:underline"
              >
                {holding?.name ?? treatment.holdingId}
              </Link>
            </KeyValue>
            <KeyValue label={t('field.plot')}>{plot?.name ?? treatment.plotId}</KeyValue>
            <KeyValue label={t('field.crop')}>{crop?.name ?? treatment.cropId}</KeyValue>
            <KeyValue label={t('field.season')}>{season?.label ?? treatment.seasonId}</KeyValue>
            <KeyValue label={t('field.product')}>
              {product?.commercialName ?? treatment.productId}
            </KeyValue>
            <KeyValue label={t('field.activeIngredient')}>
              {treatment.activeIngredientSnapshot}
            </KeyValue>
            <KeyValue label={t('field.target')}>{treatment.target}</KeyValue>
            <KeyValue label={t('field.revision')}>
              {t('treatments.revision', { revision: treatment.revision })}
            </KeyValue>
            <KeyValue label={t('treatments.createdBy')}>
              {treatment.createdBy}
              <span className="block text-xs text-ink-400">
                {formatDateTime(treatment.createdAt, language)}
              </span>
            </KeyValue>
            <KeyValue label={t('treatments.updatedBy')}>
              {treatment.updatedBy ?? '—'}
              <span className="block text-xs text-ink-400">
                {formatDateTime(treatment.updatedAt, language)}
              </span>
            </KeyValue>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KeyValue label={t('treatments.treatedArea')}>
              {formatArea(treatment.treatedAreaHa, language)}
            </KeyValue>
            <KeyValue label={t('treatments.totalCropArea')}>
              {formatArea(treatment.totalCropAreaHa, language)}
            </KeyValue>
            <KeyValue label={t('treatments.appliedDose')}>
              <span className="font-mono">
                {formatNumber(treatment.appliedDose, language, 4)} {treatment.appliedDoseUnit}
              </span>
            </KeyValue>
            <KeyValue label={t('treatments.quantityApplied')}>
              <span className="font-mono">
                {formatNumber(treatment.quantityApplied, language, 4)} {treatment.quantityUnit}
              </span>
            </KeyValue>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <KeyValue label={t('treatments.method')}>{treatment.applicationMethod ?? '—'}</KeyValue>
            <KeyValue label={t('treatments.conditions')}>{treatment.fieldConditions ?? '—'}</KeyValue>
            <KeyValue label={t('treatments.notes')} className="sm:col-span-2">
              {treatment.notes ?? '—'}
            </KeyValue>
            <KeyValue label={t('treatments.sourceInfo')} className="sm:col-span-2">
              {treatment.sourceInfo ?? '—'}
            </KeyValue>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              icon={Gauge}
              title={t('treatments.referenceDose')}
              subtitle={t('tfi.provisionalNotice')}
            />
            <div className="space-y-4">
              <KeyValue label={t('treatments.referenceDose')}>
                {treatment.referenceDose !== undefined && treatment.referenceDoseUnit ? (
                  <span className="font-mono">
                    {formatNumber(treatment.referenceDose, language, 4)}{' '}
                    {treatment.referenceDoseUnit}
                  </span>
                ) : (
                  t('treatments.referenceDoseMissing')
                )}
              </KeyValue>
              <KeyValue label={t('field.referenceDoseStatus')}>
                <Badge tone={verificationTone(treatment.referenceDoseStatus)}>
                  {t(`status.${treatment.referenceDoseStatus}`)}
                </Badge>
              </KeyValue>
              <KeyValue label={t('treatments.referenceSource')}>
                {treatment.referenceSource ?? '—'}
              </KeyValue>
              <div className="rounded-xl border border-clay-200 bg-clay-50/70 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-clay-900">
                  {t('tfi.provisionalBadge')}
                </p>
                {contribution ? (
                  <>
                    <p className="mt-1 font-mono text-xl font-bold text-ink-900">
                      {formatNumber(contribution.doseRatio, language, 3)}
                    </p>
                    <p className="text-xs text-ink-600">{t('field.doseRatio')}</p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-ink-600">
                    {exclusion
                      ? t(`tfi.reason.${exclusion.reason}`)
                      : t('tfi.noResult')}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-ink-500">
                  {t('tfi.methodologyVersion')}: demo-1.0
                </p>
              </div>
              <Link to={`/tfi?treatment=${treatment.id}`}>
                <Button variant="outline" size="sm" icon={Gauge} className="w-full">
                  {t('tfi.calculateTitle')}
                </Button>
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={Boxes}
              title={t('treatments.consumption')}
              subtitle={t('treatments.consumptionHint')}
            />
            {consumption ? (
              <div className="space-y-3">
                <KeyValue label={t('inventory.txId')}>
                  <span className="font-mono text-xs">{consumption.id}</span>
                </KeyValue>
                <KeyValue label={t('common.status')}>
                  <Badge tone={statusTone(consumption.status)}>
                    {t(`status.${consumption.status}`)}
                  </Badge>
                </KeyValue>
                <KeyValue label={t('common.quantity')}>
                  <span className="font-mono">
                    {formatNumber(consumption.quantity, language, 4)} {consumption.unit}
                  </span>
                </KeyValue>
                <KeyValue label={t('common.date')}>
                  {formatDate(consumption.occurredAt, language)}
                </KeyValue>
                <Link to="/inventory" className="text-xs font-semibold text-forest-700 hover:underline">
                  {t('nav.inventory')} →
                </Link>
              </div>
            ) : (
              <AlertBanner tone="warning" title={t('alerts.insufficientStock.title')}>
                {t('alerts.insufficientStock.description', {
                  product: product?.commercialName ?? treatment.productId,
                  holding: holding?.name ?? treatment.holdingId,
                  date: formatDate(treatment.treatmentDate, language),
                })}
              </AlertBanner>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            icon={TriangleAlert}
            title={t('alerts.title')}
            subtitle={t('alerts.subtitle')}
          />
          {relatedAlerts.length === 0 ? (
            <EmptyState compact icon={TriangleAlert} title={t('alerts.noActive')} />
          ) : (
            <ul className="space-y-2">
              {relatedAlerts.map((alert) => (
                <li key={alert.id} className="rounded-lg border border-ink-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={severityTone(alert.severity)}>{t(`severity.${alert.severity}`)}</Badge>
                    <Badge tone="slate">{t(`alerts.category.${alert.category}`)}</Badge>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-ink-800">
                    {alertTitle(t, alert)}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                    {alertDescription(t, alert)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {relatedAlerts.length > 0 ? (
            <Link to="/alerts" className="mt-3 inline-block text-xs font-semibold text-forest-700 hover:underline">
              {t('common.viewAll')} →
            </Link>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            icon={History}
            title={t('treatments.history')}
            subtitle={t('audit.notTamperProof')}
          />
          {history.length === 0 ? (
            <EmptyState compact icon={ClipboardList} title={t('audit.emptyTitle')} />
          ) : (
            <TableWrap>
              <TableHead>
                <TableRow>
                  <TableTh>{t('audit.timestamp')}</TableTh>
                  <TableTh>{t('audit.actor')}</TableTh>
                  <TableTh>{t('audit.action')}</TableTh>
                  <TableTh>{t('audit.summary')}</TableTh>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((event) => (
                  <TableRow key={event.id}>
                    <TableTd className="whitespace-nowrap text-xs">
                      {formatDateTime(event.timestamp, language)}
                    </TableTd>
                    <TableTd className="text-xs">{event.actorName}</TableTd>
                    <TableTd className="font-mono text-[11px]">{event.action}</TableTd>
                    <TableTd className="text-xs">{event.summary}</TableTd>
                  </TableRow>
                ))}
              </TableBody>
            </TableWrap>
          )}
        </Card>
      </div>

      <ReasonModal
        open={reverseOpen}
        onClose={() => setReverseOpen(false)}
        onConfirm={reverse}
        title={t('treatments.reverseTitle')}
        description={t('treatments.reverseText')}
        label={t('treatments.reverseReason')}
        confirmLabel={t('treatments.reverseTitle')}
        busy={busy === 'reverse-treatment'}
      />
    </div>
  );
}
