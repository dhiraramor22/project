import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  PackageSearch,
  Plus,
  RotateCcw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { statusTone } from '../app/status';
import { useAction } from '../app/useAction';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  toDateInput,
} from '../domain/format';
import { summarizeStock } from '../domain/inventory';
import type { InventoryMovement } from '../domain/types';
import { useI18n } from '../i18n';
import { repository } from '../repositories';
import { buildStockLines } from '../utils/data';
import { ReasonModal } from '../components/common/ReasonModal';
import { MovementFormModal } from '../components/inventory/MovementFormModal';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  PageHeader,
  Select,
  StatCard,
  TableBody,
  TableHead,
  TableRow,
  TableTd,
  TableTh,
  TableWrap,
  Tabs,
  Tab,
} from '../components/ui/primitives';

const MANUAL_TYPES = ['OPENING_BALANCE', 'RECEIPT', 'ADJUSTMENT', 'RETURN'] as const;

export function InventoryPage() {
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { can, refresh } = useWorkspace();
  const { busy, run } = useAction();
  const [tab, setTab] = useState('stock');
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [holdingFilter, setHoldingFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<InventoryMovement | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const products = useMemo(
    () => new Map(data.pesticides.map((product) => [product.id, product])),
    [data.pesticides],
  );
  const holdings = useMemo(
    () => new Map(data.holdings.map((holding) => [holding.id, holding])),
    [data.holdings],
  );

  const stockLines = useMemo(() => buildStockLines(data), [data]);
  const lowStockCount = stockLines.filter((line) => line.low).length;

  const filteredLines = useMemo(() => {
    const term = search.trim().toLowerCase();
    return stockLines
      .filter((line) => productFilter === 'all' || line.productId === productFilter)
      .filter((line) => holdingFilter === 'all' || line.holdingId === holdingFilter)
      .filter((line) => {
        if (!term) return true;
        return [line.productName, line.holdingName]
          .some((value) => value.toLowerCase().includes(term));
      })
      .sort((a, b) => {
        if (a.low !== b.low) return a.low ? -1 : 1;
        return a.productName.localeCompare(b.productName);
      });
  }, [holdingFilter, productFilter, search, stockLines]);

  const movements = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.inventoryMovements
      .filter((movement) => productFilter === 'all' || movement.productId === productFilter)
      .filter((movement) => holdingFilter === 'all' || movement.holdingId === holdingFilter)
      .filter((movement) => typeFilter === 'all' || movement.type === typeFilter)
      .filter((movement) => !fromDate || movement.occurredAt.slice(0, 10) >= fromDate)
      .filter((movement) => !toDate || movement.occurredAt.slice(0, 10) <= toDate)
      .filter((movement) => {
        if (!term) return true;
        const productName = products.get(movement.productId)?.commercialName ?? '';
        const holdingName = holdings.get(movement.holdingId)?.name ?? '';
        return [productName, holdingName, movement.supplierOrReference, movement.id, movement.notes]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .slice()
      .sort((a, b) => {
        const byDate = b.occurredAt.localeCompare(a.occurredAt);
        return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
      });
  }, [
    data.inventoryMovements,
    fromDate,
    holdingFilter,
    holdings,
    productFilter,
    products,
    search,
    toDate,
    typeFilter,
  ]);

  const lastMovement = data.inventoryMovements
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];

  const reverseMovement = async (reason: string) => {
    if (!reverseTarget) return;
    await run('reverse-movement', () => repository.reverseMovement(reverseTarget.id, reason), {
      success: t('inventory.reverseSuccess'),
      onSuccess: async () => {
        setReverseTarget(null);
        await refresh();
      },
    });
  };

  const canWrite = can('inventory:write');
  const filtersActive =
    productFilter !== 'all' ||
    holdingFilter !== 'all' ||
    typeFilter !== 'all' ||
    Boolean(fromDate) ||
    Boolean(toDate) ||
    Boolean(search);

  return (
    <div>
      <PageHeader
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle')}
        eyebrow={t('nav.section.operations')}
        actions={
          canWrite ? (
            <Button icon={Plus} onClick={() => setFormOpen(true)}>
              {t('inventory.addMovement')}
            </Button>
          ) : undefined
        }
      />

      <AlertBanner tone="info" className="mb-5">
        {t('inventory.totalQuantitiesNote')}
      </AlertBanner>

      {errorBanner(warnings, t, () => setWarnings([]))}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('inventory.totalMovements')}
          value={formatNumber(data.inventoryMovements.length, language, 0)}
          hint={t('inventory.txId')}
          icon={ClipboardList}
          tone="sky"
        />
        <StatCard
          label={t('inventory.stockLine')}
          value={formatNumber(stockLines.length, language, 0)}
          hint={t('inventory.calculatedBalance')}
          icon={Boxes}
          tone="green"
        />
        <StatCard
          label={t('inventory.lowStockCount')}
          value={formatNumber(lowStockCount, language, 0)}
          hint={t('inventory.lowStockWarning')}
          icon={TriangleAlert}
          tone={lowStockCount > 0 ? 'red' : 'green'}
        />
        <StatCard
          label={t('inventory.lastMovement')}
          value={lastMovement ? formatDate(lastMovement.occurredAt, language) : 'â€”'}
          hint={
            lastMovement
              ? products.get(lastMovement.productId)?.commercialName ?? ''
              : t('inventory.movementsEmpty')
          }
          icon={PackageSearch}
          tone="clay"
        />
      </div>

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label={t('common.search')} htmlFor="inventory-search">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <input
                id="inventory-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('inventory.searchPlaceholder')}
                className="w-full rounded-lg border border-ink-200 bg-white py-2 pe-3 ps-9 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
              />
            </div>
          </Field>
          <Field label={t('inventory.filterProduct')} htmlFor="inventory-product">
            <Select
              id="inventory-product"
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
          <Field label={t('inventory.filterHolding')} htmlFor="inventory-holding">
            <Select
              id="inventory-holding"
              value={holdingFilter}
              onChange={(event) => setHoldingFilter(event.target.value)}
            >
              <option value="all">{t('common.allHoldings')}</option>
              {data.holdings.map((holding) => (
                <option key={holding.id} value={holding.id}>
                  {holding.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('inventory.filterFrom')} htmlFor="inventory-from">
            <input
              id="inventory-from"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
            />
          </Field>
          <Field label={t('inventory.filterTo')} htmlFor="inventory-to">
            <input
              id="inventory-to"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="inventory-type" className="text-xs font-semibold text-ink-600">
            {t('inventory.filterType')}
          </label>
          <Select
            id="inventory-type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="max-w-56"
          >
            <option value="all">{t('common.allTypes')}</option>
            {['OPENING_BALANCE', 'RECEIPT', 'CONSUMPTION', 'ADJUSTMENT', 'RETURN'].map((type) => (
              <option key={type} value={type}>
                {t(`movementType.${type}`)}
              </option>
            ))}
          </Select>
          {filtersActive ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setProductFilter('all');
                setHoldingFilter('all');
                setTypeFilter('all');
                setFromDate('');
                setToDate('');
              }}
            >
              {t('common.clearFilters')}
            </Button>
          ) : null}
        </div>
      </Card>

      <Tabs value={tab} onChange={setTab} className="mb-4">
        <Tab value="stock">{t('inventory.summary')}</Tab>
        <Tab value="movements">{t('inventory.movements')}</Tab>
      </Tabs>

      {tab === 'stock' ? (
        filteredLines.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={t('inventory.emptyTitle')}
            description={t('inventory.emptyText')}
            action={canWrite ? <Button icon={Plus} onClick={() => setFormOpen(true)}>{t('inventory.addMovement')}</Button> : undefined}
          />
        ) : (
          <TableWrap>
            <TableHead>
              <TableRow>
                <TableTh>{t('inventory.table.product')}</TableTh>
                <TableTh>{t('inventory.table.holding')}</TableTh>
                <TableTh>{t('inventory.opening')}</TableTh>
                <TableTh>{t('inventory.incoming')}</TableTh>
                <TableTh>{t('inventory.outgoing')}</TableTh>
                <TableTh>{t('inventory.adjustments')}</TableTh>
                <TableTh>{t('inventory.balance')}</TableTh>
                <TableTh>{t('inventory.threshold')}</TableTh>
                <TableTh>{t('inventory.table.status')}</TableTh>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLines.map((line) => {
                const product = products.get(line.productId);
                const summary = summarizeStock(
                  data.inventoryMovements,
                  line.holdingId,
                  line.productId,
                  line.unit,
                );
                return (
                  <TableRow key={line.key}>
                    <TableTd>
                      <span className="block font-semibold text-ink-900">{line.productName}</span>
                      <span className="block text-xs text-ink-500">{product?.activeIngredient}</span>
                    </TableTd>
                    <TableTd>
                      <Link to={`/holdings/${line.holdingId}`} className="font-medium text-forest-800 hover:underline">
                        {line.holdingName}
                      </Link>
                    </TableTd>
                    <TableTd className="font-mono text-xs">
                      {formatNumber(summary.openingBalance, language)}
                    </TableTd>
                    <TableTd className="font-mono text-xs">
                      {formatNumber(summary.incoming, language)}
                    </TableTd>
                    <TableTd className="font-mono text-xs">
                      {formatNumber(summary.outgoing, language)}
                    </TableTd>
                    <TableTd className="font-mono text-xs">
                      +{formatNumber(summary.adjustmentsIn, language)} / âˆ’
                      {formatNumber(summary.adjustmentsOut, language)}
                    </TableTd>
                    <TableTd>
                      <span className="font-mono font-semibold text-ink-900">
                        {formatNumber(line.balance, language)} {line.unit}
                      </span>
                    </TableTd>
                    <TableTd className="font-mono text-xs">
                      {formatNumber(line.threshold, language)} {line.unit}
                    </TableTd>
                    <TableTd>
                      <Badge tone={line.low ? (line.balance <= 0 ? 'red' : 'amber') : 'green'}>
                        {line.low ? t('inventory.low') : t('inventory.ok')}
                      </Badge>
                    </TableTd>
                  </TableRow>
                );
              })}
            </TableBody>
          </TableWrap>
        )
      ) : movements.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('inventory.emptyTitle')}
          description={t('inventory.movementsEmpty')}
        />
      ) : (
        <TableWrap>
          <TableHead>
            <TableRow>
              <TableTh>{t('inventory.table.date')}</TableTh>
              <TableTh>{t('inventory.table.product')}</TableTh>
              <TableTh>{t('inventory.table.holding')}</TableTh>
              <TableTh>{t('inventory.table.type')}</TableTh>
              <TableTh>{t('inventory.table.quantity')}</TableTh>
              <TableTh>{t('inventory.table.reference')}</TableTh>
              <TableTh>{t('inventory.table.status')}</TableTh>
              <TableTh>{t('inventory.table.user')}</TableTh>
              {canWrite ? <TableTh>{t('inventory.table.actions')}</TableTh> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {movements.map((movement) => {
              const product = products.get(movement.productId);
              const holding = holdings.get(movement.holdingId);
              const incoming = movement.type !== 'CONSUMPTION' &&
                !(movement.type === 'ADJUSTMENT' && movement.adjustmentDirection === 'OUT');
              const linked = Boolean(movement.treatmentId);
              return (
                <TableRow key={movement.id}>
                  <TableTd className="whitespace-nowrap">
                    {formatDate(movement.occurredAt, language)}
                    <span className="block text-[11px] text-ink-400">{movement.id}</span>
                  </TableTd>
                  <TableTd>
                    <span className="font-medium text-ink-800">{product?.commercialName ?? movement.productId}</span>
                    {movement.treatmentId ? (
                      <Link
                        to={`/treatments/${movement.treatmentId}`}
                        className="mt-0.5 block text-[11px] text-forest-700 hover:underline"
                      >
                        {t('treatments.linkedMovement')}
                      </Link>
                    ) : null}
                  </TableTd>
                  <TableTd>{holding?.name ?? movement.holdingId}</TableTd>
                  <TableTd>
                    <span className="flex items-center gap-1.5">
                      {incoming ? (
                        <ArrowDownLeft size={14} className="text-forest-600" aria-hidden />
                      ) : (
                        <ArrowUpRight size={14} className="text-clay-600" aria-hidden />
                      )}
                      {t(`movementType.${movement.type}`)}
                    </span>
                    {movement.type === 'ADJUSTMENT' ? (
                      <span className="block text-[11px] text-ink-400">
                        {t(`status.${movement.adjustmentDirection ?? 'IN'}`)}
                      </span>
                    ) : null}
                  </TableTd>
                  <TableTd>
                    <span
                      className={
                        incoming
                          ? 'font-mono font-semibold text-forest-800'
                          : 'font-mono font-semibold text-clay-800'
                      }
                    >
                      {incoming ? '+' : 'âˆ’'}
                      {formatNumber(movement.quantity, language)} {movement.unit}
                    </span>
                  </TableTd>
                  <TableTd>{movement.supplierOrReference ?? 'â€”'}</TableTd>
                  <TableTd>
                    <Badge tone={statusTone(movement.status)}>{t(`status.${movement.status}`)}</Badge>
                    {movement.reversalReason ? (
                      <span className="mt-1 block text-[11px] text-ink-500">{movement.reversalReason}</span>
                    ) : null}
                  </TableTd>
                  <TableTd>
                    {movement.createdBy}
                    <span className="block text-[11px] text-ink-400">
                      {formatDateTime(movement.createdAt, language)}
                    </span>
                  </TableTd>
                  {canWrite ? (
                    <TableTd>
                      {movement.status === 'ACTIVE' && !linked ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={RotateCcw}
                          onClick={() => setReverseTarget(movement)}
                        >
                          {t('inventory.reverseTitle')}
                        </Button>
                      ) : (
                        <span className="text-xs text-ink-400">
                          {linked ? t('error.movementLinked') : 'â€”'}
                        </span>
                      )}
                    </TableTd>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </TableWrap>
      )}

      <Card className="mt-5">
        <CardHeader icon={TriangleAlert} title={t('inventory.autoBalanceNote')} subtitle={t('inventory.viewMovementsHint')} />
        <p className="text-xs leading-relaxed text-ink-500">{t('inventory.negativeStockNote')}</p>
      </Card>

      <MovementFormModal
        open={formOpen}
        data={data}
        defaultHoldingId={holdingFilter === 'all' ? undefined : holdingFilter}
        defaultProductId={productFilter === 'all' ? undefined : productFilter}
        onClose={() => setFormOpen(false)}
        onSaved={async (_movement, nextWarnings) => {
          setWarnings(nextWarnings);
          await refresh();
        }}
      />

      <ReasonModal
        open={Boolean(reverseTarget)}
        onClose={() => setReverseTarget(null)}
        onConfirm={reverseMovement}
        title={t('inventory.reverseTitle')}
        description={t('inventory.reverseText')}
        label={t('inventory.reverseReason')}
        confirmLabel={t('inventory.reverseTitle')}
        busy={busy === 'reverse-movement'}
      />

      {reverseTarget ? (
        <div className="mt-2 text-xs text-ink-500">
          {t('inventory.available')}: {formatNumber(
            summarizeStock(
              data.inventoryMovements,
              reverseTarget.holdingId,
              reverseTarget.productId,
              products.get(reverseTarget.productId)?.stockUnit ?? reverseTarget.unit,
            ).balance,
            language,
          )}{' '}
          {products.get(reverseTarget.productId)?.stockUnit ?? reverseTarget.unit}
        </div>
      ) : null}
    </div>
  );
}

function errorBanner(
  warnings: string[],
  t: (key: string, vars?: Record<string, string | number>) => string,
  onClose: () => void,
) {
  if (warnings.length === 0) return null;
  return (
    <AlertBanner tone="warning" className="mb-4" title={t('holdings.warningTitle')}>
      <ul className="list-inside list-disc space-y-1">
        {warnings.map((warning) => (
          <li key={warning}>{t(`warning.${warning}`)}</li>
        ))}
      </ul>
      <button type="button" onClick={onClose} className="mt-2 text-xs font-semibold underline">
        {t('common.close')}
      </button>
    </AlertBanner>
  );
}

