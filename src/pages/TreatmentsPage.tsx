import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Edit3,
  Eye,
  Plus,
  Printer,
  RotateCcw,
  Search,
  SprayCan,
  TriangleAlert,
} from 'lucide-react';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { statusTone, verificationTone } from '../app/status';
import { useAction } from '../app/useAction';
import { formatArea, formatDate, formatNumber, isoDate } from '../domain/format';
import type { TreatmentRecord } from '../domain/types';
import { useI18n } from '../i18n';
import { repository } from '../repositories';
import { activeSeason, cropsById, farmersById, holdingsById, productsById, seasonsById } from '../utils/data';
import { printTable } from '../utils/export';
import { ReasonModal } from '../components/common/ReasonModal';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Select,
  TableBody,
  TableHead,
  TableRow,
  TableTd,
  TableTh,
  TableWrap,
  DemoBadge,
} from '../components/ui/primitives';

export function TreatmentsPage() {
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { can, refresh } = useWorkspace();
  const { busy, run } = useAction();
  const season = activeSeason(data);
  const [search, setSearch] = useState('');
  const [seasonFilter, setSeasonFilter] = useState(season?.id ?? 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [reverseTarget, setReverseTarget] = useState<TreatmentRecord | null>(null);

  const cropMap = useMemo(() => cropsById(data), [data]);
  const productMap = useMemo(() => productsById(data), [data]);
  const holdingMap = useMemo(() => holdingsById(data), [data]);
  const farmerMap = useMemo(() => farmersById(data), [data]);
  const seasonMap = useMemo(() => seasonsById(data), [data]);

  const treatments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.treatments
      .filter((treatment) => seasonFilter === 'all' || treatment.seasonId === seasonFilter)
      .filter((treatment) => statusFilter === 'all' || treatment.status === statusFilter)
      .filter((treatment) => productFilter === 'all' || treatment.productId === productFilter)
      .filter((treatment) => {
        if (!term) return true;
        const crop = cropMap.get(treatment.cropId)?.name ?? '';
        const product = productMap.get(treatment.productId)?.commercialName ?? '';
        const holding = holdingMap.get(treatment.holdingId)?.name ?? '';
        return [crop, product, holding, treatment.target, treatment.id, treatment.notes]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => {
        const byDate = b.treatmentDate.localeCompare(a.treatmentDate);
        return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
      });
  }, [
    cropMap,
    data.treatments,
    holdingMap,
    productFilter,
    productMap,
    search,
    seasonFilter,
    statusFilter,
  ]);

  const reverse = async (reason: string) => {
    if (!reverseTarget) return;
    await run('reverse-treatment', () => repository.reverseTreatment(reverseTarget.id, reason), {
      success: t('treatments.reverseSuccess'),
      onSuccess: async () => {
        setReverseTarget(null);
        await refresh();
      },
    });
  };

  const printRegister = () => {
    const rows = treatments.map((treatment) => [
      treatment.id,
      formatDate(treatment.treatmentDate, language),
      cropMap.get(treatment.cropId)?.name ?? treatment.cropId,
      holdingMap.get(treatment.holdingId)?.name ?? treatment.holdingId,
      productMap.get(treatment.productId)?.commercialName ?? treatment.productId,
      treatment.target,
      formatNumber(treatment.treatedAreaHa, language),
      `${formatNumber(treatment.appliedDose, language, 4)} ${treatment.appliedDoseUnit}`,
      `${formatNumber(treatment.quantityApplied, language, 4)} ${treatment.quantityUnit}`,
      t(`status.${treatment.status}`),
    ]);
    const opened = printTable({
      title: t('treatments.registerTitle'),
      subtitle: t('treatments.registerSubtitle'),
      meta: [
        `${t('app.institution')} · ${t('app.demoData')}`,
        `${t('reports.generatedAt')}: ${formatDate(isoDate(), language)}`,
        `${t('reports.rowCount', { count: rows.length })} · ${t('tfi.provisionalBadge')}`,
      ],
      headers: [
        t('common.id'),
        t('treatments.table.date'),
        t('treatments.table.crop'),
        t('treatments.table.holding'),
        t('treatments.table.product'),
        t('treatments.table.target'),
        t('treatments.table.area'),
        t('treatments.table.dose'),
        t('treatments.table.quantity'),
        t('treatments.table.status'),
      ],
      rows,
      notice: t('app.prototypeNotice'),
      direction: language === 'ar' ? 'rtl' : 'ltr',
      language,
    });
    if (!opened) window.alert(t('map.loadFailed'));
  };

  const canWrite = can('treatment:write');
  const canReverse = can('treatment:reverse');
  const filtersActive = Boolean(search) || seasonFilter !== 'all' || statusFilter !== 'all' || productFilter !== 'all';

  return (
    <div>
      <PageHeader
        title={t('treatments.title')}
        subtitle={t('treatments.subtitle')}
        eyebrow={t('nav.section.operations')}
        actions={
          <>
            <Button variant="outline" icon={Printer} onClick={printRegister}>
              {t('treatments.printRegister')}
            </Button>
            {canWrite ? (
              <Link to="/treatments/new">
                <Button icon={Plus}>{t('treatments.new')}</Button>
              </Link>
            ) : null}
            <DemoBadge />
          </>
        }
      />

      <AlertBanner tone="info" className="mb-5" title={t('treatments.correctionWorkflow')}>
        {t('treatments.correctionWorkflowText')}
      </AlertBanner>

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label={t('common.search')} htmlFor="treatment-search">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <input
                id="treatment-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('treatments.searchPlaceholder')}
                className="w-full rounded-lg border border-ink-200 bg-white py-2 pe-3 ps-9 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
              />
            </div>
          </Field>
          <Field label={t('field.season')} htmlFor="treatment-season">
            <Select
              id="treatment-season"
              value={seasonFilter}
              onChange={(event) => setSeasonFilter(event.target.value)}
            >
              <option value="all">{t('common.allSeasons')}</option>
              {data.seasons.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('treatments.statusFilter')} htmlFor="treatment-status">
            <Select
              id="treatment-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">{t('common.allStatuses')}</option>
              <option value="ACTIVE">{t('status.ACTIVE')}</option>
              <option value="REVERSED">{t('status.REVERSED')}</option>
            </Select>
          </Field>
          <Field label={t('field.product')} htmlFor="treatment-product">
            <Select
              id="treatment-product"
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
            >
              <option value="all">{t('common.allProducts')}</option>
              {data.pesticides.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.commercialName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span className="font-semibold text-ink-700">
            {t('treatments.recordsCount', { count: formatNumber(treatments.length, language, 0) })}
          </span>
          {filtersActive ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setSeasonFilter('all');
                setStatusFilter('all');
                setProductFilter('all');
              }}
            >
              {t('common.clearFilters')}
            </Button>
          ) : null}
        </div>
      </Card>

      {treatments.length === 0 ? (
        <EmptyState
          icon={SprayCan}
          title={t('treatments.emptyTitle')}
          description={t('treatments.emptyText')}
          action={
            canWrite ? (
              <Link to="/treatments/new">
                <Button icon={Plus}>{t('treatments.new')}</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <TableWrap>
          <TableHead>
            <TableRow>
              <TableTh>{t('treatments.table.date')}</TableTh>
              <TableTh>{t('treatments.table.crop')}</TableTh>
              <TableTh>{t('treatments.table.holding')}</TableTh>
              <TableTh>{t('treatments.table.product')}</TableTh>
              <TableTh>{t('treatments.table.target')}</TableTh>
              <TableTh>{t('treatments.table.area')}</TableTh>
              <TableTh>{t('treatments.table.dose')}</TableTh>
              <TableTh>{t('treatments.table.quantity')}</TableTh>
              <TableTh>{t('treatments.table.status')}</TableTh>
              <TableTh>{t('treatments.table.actions')}</TableTh>
            </TableRow>
          </TableHead>
          <TableBody>
            {treatments.map((treatment) => {
              const crop = cropMap.get(treatment.cropId);
              const holding = holdingMap.get(treatment.holdingId);
              const product = productMap.get(treatment.productId);
              const recordSeason = seasonMap.get(treatment.seasonId);
              return (
                <TableRow key={treatment.id}>
                  <TableTd className="whitespace-nowrap">
                    {formatDate(treatment.treatmentDate, language)}
                    <span className="block text-[11px] text-ink-400">{recordSeason?.label}</span>
                  </TableTd>
                  <TableTd>
                    <Link to={`/treatments/${treatment.id}`} className="font-semibold text-forest-800 hover:underline">
                      {crop?.name ?? treatment.cropId}
                    </Link>
                    <span className="block text-[11px] text-ink-400">{treatment.id}</span>
                  </TableTd>
                  <TableTd>
                    {holding?.name ?? treatment.holdingId}
                    <span className="block text-[11px] text-ink-400">
                      {farmerMap.get(treatment.farmerId)}
                    </span>
                  </TableTd>
                  <TableTd>
                    {product?.commercialName ?? treatment.productId}
                    <span className="mt-1 block">
                      <Badge tone={verificationTone(treatment.referenceDoseStatus)}>
                        {t(`status.${treatment.referenceDoseStatus}`)}
                      </Badge>
                    </span>
                  </TableTd>
                  <TableTd>{treatment.target}</TableTd>
                  <TableTd>
                    {formatArea(treatment.treatedAreaHa, language)}
                    {treatment.treatedAreaHa > treatment.totalCropAreaHa + 0.0001 ? (
                      <Badge tone="amber" className="mt-1">
                        {t('alerts.category.AREA_MISMATCH')}
                      </Badge>
                    ) : null}
                  </TableTd>
                  <TableTd className="font-mono text-xs">
                    {formatNumber(treatment.appliedDose, language, 4)} {treatment.appliedDoseUnit}
                  </TableTd>
                  <TableTd className="font-mono text-xs">
                    {formatNumber(treatment.quantityApplied, language, 3)} {treatment.quantityUnit}
                  </TableTd>
                  <TableTd>
                    <Badge tone={statusTone(treatment.status)}>{t(`status.${treatment.status}`)}</Badge>
                    {treatment.revision > 1 ? (
                      <span className="mt-1 block text-[11px] text-ink-400">
                        {t('treatments.revision', { revision: treatment.revision })}
                      </span>
                    ) : null}
                  </TableTd>
                  <TableTd>
                    <div className="flex flex-wrap gap-1.5">
                      <Link to={`/treatments/${treatment.id}`}>
                        <Button size="sm" variant="outline" icon={Eye}>
                          {t('common.view')}
                        </Button>
                      </Link>
                      {canWrite && treatment.status === 'ACTIVE' ? (
                        <Link to={`/treatments/${treatment.id}/edit`}>
                          <Button size="sm" variant="ghost" icon={Edit3}>
                            {t('common.edit')}
                          </Button>
                        </Link>
                      ) : null}
                      {canReverse && treatment.status === 'ACTIVE' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={RotateCcw}
                          onClick={() => setReverseTarget(treatment)}
                        >
                          {t('treatments.reverseTitle')}
                        </Button>
                      ) : null}
                    </div>
                  </TableTd>
                </TableRow>
              );
            })}
          </TableBody>
        </TableWrap>
      )}

      <Card className="mt-5">
        <div className="flex items-start gap-3">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink-800">{t('treatments.duplicateNote')}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">{t('inventory.consumptionNote')}</p>
          </div>
        </div>
      </Card>

      <ReasonModal
        open={Boolean(reverseTarget)}
        onClose={() => setReverseTarget(null)}
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
