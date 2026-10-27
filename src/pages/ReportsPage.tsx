import { useMemo, useState } from 'react';
import {
  Download,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  Table2,
} from 'lucide-react';
import { REPORT_ALLOWED_ROLES, REPORT_TYPES, type ReportResult, type ReportType } from '../domain/api';
import { formatDate, formatDateTime, formatNumber } from '../domain/format';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { translateServerError, useI18n } from '../i18n';
import { repository } from '../repositories';
import { ApiRequestError } from '../services/apiClient';
import { downloadCsv, downloadXlsx, fileStamp, printTable } from '../utils/export';
import { useToast } from '../components/ui/ToastProvider';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  DemoBadge,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  TableBody,
  TableHead,
  TableRow,
  TableTd,
  TableTh,
  TableWrap,
} from '../components/ui/primitives';

type FilterField = 'season' | 'crop' | 'holding' | 'product' | 'from' | 'to' | 'status';
type ReportFiltersState = Record<FilterField, string>;

const EMPTY_FILTERS: ReportFiltersState = {
  season: '',
  crop: '',
  holding: '',
  product: '',
  from: '',
  to: '',
  status: '',
};

const FILTERS_BY_TYPE: Record<ReportType, FilterField[]> = {
  'inventory-balances': ['holding', 'product'],
  'inventory-movements': ['holding', 'product', 'status', 'from', 'to'],
  treatments: ['holding', 'crop', 'season', 'product', 'status', 'from', 'to'],
  'treatments-by-crop': ['holding', 'crop', 'season', 'product', 'from', 'to'],
  'treatments-by-product': ['holding', 'crop', 'season', 'product', 'from', 'to'],
  'tfi-by-crop-season': ['holding', 'crop', 'season', 'product', 'from', 'to'],
  farmers: ['status'],
  holdings: ['status'],
  registrations: ['status'],
  'low-stock-alerts': ['holding', 'product'],
  'audit-logs': ['from', 'to'],
};

const STATUS_OPTIONS = [
  'ACTIVE',
  'CLOSED',
  'ARCHIVED',
  'APPROVED',
  'PENDING',
  'REJECTED',
  'SUSPENDED',
  'REVERSED',
  'OK',
  'INCOMPLETE',
  'EMPTY',
] as const;

const STATUS_VALUES = new Set<string>(STATUS_OPTIONS);
const ROLE_VALUES = new Set(['DSA_ADMIN', 'CHAMBER_ADMIN', 'FARMER']);
const SOURCE_VALUES = new Set(['SELF', 'ADMIN']);
const MOVEMENT_VALUES = new Set(['OPENING_BALANCE', 'RECEIPT', 'CONSUMPTION', 'ADJUSTMENT', 'RETURN']);
const REFERENCE_DOSE_VALUES = new Set(['VERIFIED', 'DEMO', 'MISSING']);
const SEVERITY_VALUES = new Set(['INFO', 'WARNING', 'CRITICAL']);

const DATE_COLUMNS = new Set(['date', 'submitted', 'detected']);
const DATETIME_COLUMNS = new Set(['timestamp']);

function reportFileBase(type: ReportType): string {
  return `el-oued-${type}-${fileStamp()}`;
}

export function ReportsPage() {
  const { t, language, dir } = useI18n();
  const data = useWorkspaceData();
  const { can } = useWorkspace();
  const { notify } = useToast();

  const availableTypes = useMemo(
    () => REPORT_TYPES.filter((type) => REPORT_ALLOWED_ROLES[type].includes(data.role)),
    [data.role],
  );

  const [reportType, setReportType] = useState<ReportType>(availableTypes[0] ?? 'inventory-balances');
  const [filters, setFilters] = useState<ReportFiltersState>(EMPTY_FILTERS);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);

  const activeFilters = FILTERS_BY_TYPE[reportType];

  const setFilter = (field: FilterField, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setResult(null);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setResult(null);
  };

  const generate = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await repository.generateReport(reportType, {
        seasonId: filters.season || undefined,
        cropId: filters.crop || undefined,
        holdingId: filters.holding || undefined,
        productId: filters.product || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        status: filters.status || undefined,
      });
      setResult(response);
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? translateServerError(t, caught.code, caught.message)
          : t('error.generic'),
      );
    } finally {
      setLoading(false);
    }
  };

  const displayCell = (columnKey: string, value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') {
      return formatNumber(value, language, 4);
    }
    const text = String(value);
    if (DATE_COLUMNS.has(columnKey)) return formatDate(text, language);
    if (DATETIME_COLUMNS.has(columnKey)) return formatDateTime(text, language);
    if (columnKey === 'type' && MOVEMENT_VALUES.has(text)) return t(`movementType.${text}`);
    if (columnKey === 'status' && STATUS_VALUES.has(text)) return t(`status.${text}`);
    if (columnKey === 'role' && ROLE_VALUES.has(text)) return t(`role.${text}`);
    if (columnKey === 'source' && SOURCE_VALUES.has(text)) return t(`status.${text}`);
    if (columnKey === 'referenceDoseStatus' && REFERENCE_DOSE_VALUES.has(text)) {
      return t(`refDose.${text}`);
    }
    if (columnKey === 'severity' && SEVERITY_VALUES.has(text)) return t(`severity.${text}`);
    if (columnKey === 'lowStock') return text === 'yes' ? t('common.yes') : t('common.no');
    return text;
  };

  const exportRows = (): Array<Array<string | number | null>> => {
    if (!result) return [];
    return result.rows.map((row) =>
      result.columns.map((column) => displayCell(column.key, row[column.key])),
    );
  };

  const exportHeaders = (): string[] => {
    if (!result) return [];
    return result.columns.map((column) => t(column.labelKey));
  };

  const applyFilters = () => {
    if (!result) return [];
    const entries: string[] = [];
    if (result.filters.seasonId) {
      const season = data.seasons.find((item) => item.id === result.filters.seasonId);
      entries.push(`${t('reports.filterSeason')}: ${season?.label ?? result.filters.seasonId}`);
    }
    if (result.filters.cropId) {
      const crop = data.crops.find((item) => item.id === result.filters.cropId);
      entries.push(`${t('reports.filterCrop')}: ${crop?.name ?? result.filters.cropId}`);
    }
    if (result.filters.holdingId) {
      const holding = data.holdings.find((item) => item.id === result.filters.holdingId);
      entries.push(`${t('reports.filterHolding')}: ${holding?.name ?? result.filters.holdingId}`);
    }
    if (result.filters.productId) {
      const product = data.pesticides.find((item) => item.id === result.filters.productId);
      entries.push(`${t('reports.filterProduct')}: ${product?.commercialName ?? result.filters.productId}`);
    }
    if (result.filters.from) entries.push(`${t('reports.filterFrom')}: ${result.filters.from}`);
    if (result.filters.to) entries.push(`${t('reports.filterTo')}: ${result.filters.to}`);
    if (result.filters.status) entries.push(`${t('reports.filterStatus')}: ${t(`status.${result.filters.status}`)}`);
    return entries;
  };

  const exportCsv = () => {
    if (!result) return;
    downloadCsv(reportFileBase(result.reportType), exportHeaders(), exportRows());
    notify(t('reports.downloadStarted'));
  };

  const exportXlsx = async () => {
    if (!result) return;
    setExporting('xlsx');
    try {
      await downloadXlsx(
        reportFileBase(result.reportType),
        t(result.titleKey).slice(0, 30),
        exportHeaders(),
        exportRows(),
      );
      notify(t('reports.downloadStarted'));
    } catch {
      notify(t('error.generic'), 'error');
    } finally {
      setExporting(null);
    }
  };

  const print = () => {
    if (!result) return;
    const printed = printTable({
      title: t(result.titleKey),
      subtitle: t(result.descriptionKey),
      meta: [
        `${t('reports.printGenerated')}: ${formatDateTime(result.generatedAt, language)}`,
        `${t('reports.printPreparedBy')}: ${data.user.fullName}`,
        ...applyFilters(),
      ],
      headers: exportHeaders(),
      rows: exportRows(),
      notice: t('reports.demoNotice'),
      direction: dir,
      language,
    });
    if (!printed) notify(t('error.generic'), 'error');
  };

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.section.oversight')}
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        actions={<DemoBadge />}
      />

      <AlertBanner tone="info" className="mb-5" title={t('reports.demoNotice')}>
        <p>{t('reports.permissionNote')}</p>
      </AlertBanner>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card>
          <CardHeader
            icon={FileBarChart2}
            title={t('reports.selectReport')}
            subtitle={t('reports.selectToPreview')}
          />
          <div className="space-y-4">
            <Field label={t('reports.selectReport')} htmlFor="report-type">
              <Select
                id="report-type"
                value={reportType}
                onChange={(event) => {
                  setReportType(event.target.value as ReportType);
                  setFilters(EMPTY_FILTERS);
                  setResult(null);
                  setError(null);
                }}
              >
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {t(`reports.type.${type}.title`)}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="rounded-lg border border-ink-100 bg-ink-50/60 px-3 py-2 text-xs leading-relaxed text-ink-600">
              {t(`reports.type.${reportType}.description`)}
            </p>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-ink-600">
                  {t('reports.filters')}
                </h3>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-semibold text-forest-700 hover:underline"
                >
                  {t('reports.resetFilters')}
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {activeFilters.includes('season') ? (
                  <Field label={t('reports.filterSeason')} htmlFor="report-season">
                    <Select
                      id="report-season"
                      value={filters.season}
                      onChange={(event) => setFilter('season', event.target.value)}
                    >
                      <option value="">{t('reports.filterAll')}</option>
                      {data.seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                {activeFilters.includes('crop') ? (
                  <Field label={t('reports.filterCrop')} htmlFor="report-crop">
                    <Select
                      id="report-crop"
                      value={filters.crop}
                      onChange={(event) => setFilter('crop', event.target.value)}
                    >
                      <option value="">{t('reports.filterAll')}</option>
                      {data.crops.map((crop) => (
                        <option key={crop.id} value={crop.id}>
                          {crop.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                {activeFilters.includes('holding') ? (
                  <Field label={t('reports.filterHolding')} htmlFor="report-holding">
                    <Select
                      id="report-holding"
                      value={filters.holding}
                      onChange={(event) => setFilter('holding', event.target.value)}
                    >
                      <option value="">{t('reports.filterAll')}</option>
                      {data.holdings.map((holding) => (
                        <option key={holding.id} value={holding.id}>
                          {holding.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                {activeFilters.includes('product') ? (
                  <Field label={t('reports.filterProduct')} htmlFor="report-product">
                    <Select
                      id="report-product"
                      value={filters.product}
                      onChange={(event) => setFilter('product', event.target.value)}
                    >
                      <option value="">{t('reports.filterAll')}</option>
                      {data.pesticides.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.commercialName}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                {activeFilters.includes('status') ? (
                  <Field label={t('reports.filterStatus')} htmlFor="report-status">
                    <Select
                      id="report-status"
                      value={filters.status}
                      onChange={(event) => setFilter('status', event.target.value)}
                    >
                      <option value="">{t('reports.filterAll')}</option>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {t(`status.${status}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                {activeFilters.includes('from') ? (
                  <Field label={t('reports.filterFrom')} htmlFor="report-from">
                    <Input
                      id="report-from"
                      type="date"
                      max={filters.to || undefined}
                      value={filters.from}
                      onChange={(event) => setFilter('from', event.target.value)}
                    />
                  </Field>
                ) : null}
                {activeFilters.includes('to') ? (
                  <Field label={t('reports.filterTo')} htmlFor="report-to">
                    <Input
                      id="report-to"
                      type="date"
                      min={filters.from || undefined}
                      value={filters.to}
                      onChange={(event) => setFilter('to', event.target.value)}
                    />
                  </Field>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button icon={RefreshCw} onClick={() => void generate()} loading={loading}>
                {t('reports.generate')}
              </Button>
              <span className="text-xs text-ink-500">{t('reports.auditNote')}</span>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            icon={Table2}
            title={t('reports.preview')}
            subtitle={result ? t(result.descriptionKey) : t('reports.emptyText')}
            action={
              result ? (
                <Badge tone="slate">{t('reports.rowCount', { count: result.rowCount })}</Badge>
              ) : undefined
            }
          />
          {!result ? (
            <EmptyState
              icon={FileText}
              title={t('reports.emptyTitle')}
              description={t('reports.emptyText')}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="grid gap-2 text-xs text-ink-600 sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-ink-800">{t('reports.generatedAt')}:</span>{' '}
                  {formatDateTime(result.generatedAt, language)}
                </p>
                <p>
                  <span className="font-semibold text-ink-800">{t('reports.preparedBy')}:</span>{' '}
                  {data.user.fullName}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Download}
                  onClick={exportCsv}
                  disabled={exporting !== null}
                >
                  {t('reports.exportCsv')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={FileSpreadsheet}
                  onClick={() => void exportXlsx()}
                  loading={exporting === 'xlsx'}
                  disabled={exporting !== null}
                >
                  {t('reports.exportXlsx')}
                </Button>
                <Button variant="outline" size="sm" icon={Printer} onClick={print}>
                  {t('reports.exportPdf')}
                </Button>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
                {t('reports.printHint')} {t('reports.internalNote')}
              </p>

              {applyFilters().length > 0 ? (
                <div className="mt-3 rounded-lg border border-ink-100 bg-ink-50/60 px-3 py-2 text-xs text-ink-600">
                  <span className="font-semibold text-ink-800">{t('reports.filtersApplied')}:</span>{' '}
                  {applyFilters().join(' · ')}
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-500">{t('reports.noFilters')}</p>
              )}

              {result.rows.length === 0 ? (
                <div className="mt-4">
                  <EmptyState compact icon={FileText} title={t('common.noResults')} description={t('reports.noRowsHint')} />
                </div>
              ) : (
                <div className="mt-4 min-h-0 flex-1 overflow-auto">
                  <TableWrap>
                    <TableHead>
                      <TableRow>
                        {result.columns.map((column) => (
                          <TableTh key={column.key}>{t(column.labelKey)}</TableTh>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.rows.slice(0, 100).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {result.columns.map((column) => (
                            <TableTd key={column.key} className="whitespace-nowrap text-xs">
                              {displayCell(column.key, row[column.key])}
                            </TableTd>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </TableWrap>
                  {result.rows.length > 100 ? (
                    <p className="mt-2 text-xs text-ink-500">
                      {t('common.showingRecords', { count: 100, total: result.rows.length })} —{' '}
                      {t('reports.rowCount', { count: result.rows.length })}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {error ? (
        <AlertBanner tone="danger" className="mt-5" title={t('common.error')}>
          {error}
        </AlertBanner>
      ) : null}

      {!can('report:export') ? (
        <AlertBanner tone="warning" className="mt-5" title={t('common.forbiddenTitle')}>
          {t('common.forbiddenText')}
        </AlertBanner>
      ) : null}
    </div>
  );
}
