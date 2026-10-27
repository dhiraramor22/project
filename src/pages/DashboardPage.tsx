import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  ClipboardCheck,
  FileBarChart2,
  Gauge,
  Leaf,
  PackageSearch,
  ShieldAlert,
  Sprout,
  SprayCan,
  TrendingUp,
  Users,
  Wheat,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { severityTone, alertTitle, alertDescription } from '../app/status';
import { calculateTFI } from '../domain/tfi';
import { formatArea, formatDate, formatDateTime, formatNumber, monthLabel } from '../domain/format';
import type { Language } from '../domain/types';
import { useI18n } from '../i18n';
import {
  activeSeason,
  average,
  buildStockLines,
  cropsById,
  monthKeys,
} from '../utils/data';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  KeyValue,
  PageHeader,
  SectionTitle,
  StatCard,
  TableBody,
  TableHead,
  TableRow,
  TableTd,
  TableTh,
  TableWrap,
  DemoBadge,
} from '../components/ui/primitives';

const CHART_COLORS = ['#2d7a58', '#c98a2e', '#3a916b', '#dda23e', '#8ac8a7', '#a86d27'];

function TrendChart({
  data,
  language,
  emptyLabel,
}: {
  data: Array<{ key: string; count: number }>;
  language: Language;
  emptyLabel: string;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) {
    return <p className="py-10 text-center text-sm text-ink-500">{emptyLabel}</p>;
  }
  return (
    <div className="h-60 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e9eceb" vertical={false} />
          <XAxis
            dataKey="key"
            tickFormatter={(value: string) => monthLabel(value, language)}
            tick={{ fontSize: 11, fill: '#677a70' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#677a70' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => [String(value), '']}
            labelFormatter={(value) => monthLabel(String(value), language)}
            contentStyle={{ borderRadius: 12, border: '1px solid #e9eceb', fontSize: 12 }}
          />
          <Bar dataKey="count" fill="#2d7a58" radius={[6, 6, 0, 0]} maxBarSize={42} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DashboardPage() {
  const { t, language } = useI18n();
  const { can } = useWorkspace();
  const data = useWorkspaceData();
  const role = data.role;
  const season = activeSeason(data);

  const seasonTreatments = useMemo(
    () =>
      data.treatments
        .filter((treatment) => treatment.status === 'ACTIVE' && (!season || treatment.seasonId === season.id))
        .slice()
        .sort((a, b) => b.treatmentDate.localeCompare(a.treatmentDate)),
    [data.treatments, season],
  );

  const stockLines = useMemo(() => buildStockLines(data), [data]);
  const lowStockLines = stockLines.filter((line) => line.low).slice(0, 6);
  const activeHoldings = data.holdings.filter((holding) => holding.status === 'ACTIVE');
  const totalArea = activeHoldings.reduce((sum, holding) => sum + holding.totalCultivatedAreaHa, 0);
  const pendingRequests = data.registrationRequests.filter((request) => request.status === 'PENDING');
  const openAlerts = data.alerts.filter((alert) => !alert.resolved);
  const unreadAlerts = openAlerts.filter((alert) => !alert.read);

  const trend = useMemo(() => {
    const keys = monthKeys(6);
    return keys.map((key) => ({
      key,
      count: seasonTreatments.filter((treatment) => treatment.treatmentDate.slice(0, 7) === key).length,
    }));
  }, [seasonTreatments]);

  const cropChart = useMemo(() => {
    const cropMap = cropsById(data);
    const groups = new Map<string, { name: string; area: number }>();
    for (const treatment of seasonTreatments) {
      const name = cropMap.get(treatment.cropId)?.name ?? t('common.unknown');
      const current = groups.get(treatment.cropId) ?? { name, area: 0 };
      current.area += treatment.treatedAreaHa;
      groups.set(treatment.cropId, current);
    }
    return [...groups.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.area - a.area)
      .slice(0, 6);
  }, [seasonTreatments, data, t]);

  const tfiCrops = useMemo(() => {
    if (!season) return [];
    const crops = data.crops.filter((crop) => crop.seasonId === season.id);
    return crops
      .map((crop) => ({
        crop,
        result: calculateTFI({
          treatments: data.treatments,
          crops: data.crops,
          plots: data.plots,
          holdings: data.holdings,
          config: data.tfiConfig,
          scopeType: 'CROP',
          scopeId: crop.id,
          seasonId: season.id,
        }),
      }))
      .filter((entry) => entry.result.treatmentCount > 0)
      .slice(0, 5);
  }, [data, season]);

  const averageTfi = average(tfiCrops.map((entry) => entry.result.value));

  const cards = useMemo(() => {
    const list: Array<{
      key: string;
      label: string;
      value: string;
      hint?: string;
      icon: typeof Users;
      tone: 'green' | 'amber' | 'red' | 'sky' | 'clay';
      to?: string;
    }> = [];
    list.push({
      key: 'farmers',
      label: t('dashboard.registeredFarmers'),
      value: formatNumber(
        data.farmers.filter((farmer) => farmer.status === 'APPROVED').length,
        language,
        0,
      ),
      hint: t('dashboard.farmersHint'),
      icon: Users,
      tone: 'green',
      to: can('farmer:read') ? '/farmers' : undefined,
    });
    if (can('registration:review')) {
      list.push({
        key: 'pending',
        label: t('dashboard.pendingRegistrations'),
        value: formatNumber(pendingRequests.length, language, 0),
        hint: t('dashboard.pendingHint'),
        icon: ClipboardCheck,
        tone: pendingRequests.length > 0 ? 'amber' : 'sky',
        to: '/registrations',
      });
    }
    list.push({
      key: 'holdings',
      label: t('dashboard.activeHoldings'),
      value: formatNumber(activeHoldings.length, language, 0),
      hint: t('dashboard.holdingsHint'),
      icon: Sprout,
      tone: 'green',
      to: '/holdings',
    });
    list.push({
      key: 'treatments',
      label: t('dashboard.treatmentsSeason'),
      value: formatNumber(seasonTreatments.length, language, 0),
      hint: t('dashboard.treatmentsHint'),
      icon: SprayCan,
      tone: 'sky',
      to: '/treatments',
    });
    list.push({
      key: 'low-stock',
      label: t('dashboard.lowStockAlerts'),
      value: formatNumber(stockLines.filter((line) => line.low).length, language, 0),
      hint: t('dashboard.lowStockHint2'),
      icon: AlertTriangle,
      tone: lowStockLines.length > 0 ? 'red' : 'green',
      to: '/inventory',
    });
    list.push({
      key: 'area',
      label: t('dashboard.cultivatedArea'),
      value: formatArea(totalArea, language),
      hint: t('dashboard.holdingArea'),
      icon: Wheat,
      tone: 'clay',
      to: '/map',
    });
    return list;
  }, [
    activeHoldings.length,
    can,
    data.farmers,
    language,
    lowStockLines.length,
    pendingRequests.length,
    seasonTreatments.length,
    stockLines,
    t,
    totalArea,
  ]);

  const quickActions = useMemo(() => {
    const actions: Array<{ to: string; label: string; icon: typeof Sprout }> = [
      { to: '/treatments/new', label: t('dashboard.addTreatment'), icon: SprayCan },
      { to: '/inventory', label: t('dashboard.addMovement'), icon: Boxes },
      { to: '/tfi', label: t('dashboard.viewTfi'), icon: Gauge },
      { to: '/reports', label: t('dashboard.viewReports'), icon: FileBarChart2 },
    ];
    if (role === 'FARMER') {
      actions.unshift({ to: '/holdings', label: t('dashboard.manageHolding'), icon: Leaf });
    }
    if (role === 'DSA_ADMIN') {
      actions.unshift({ to: '/registrations', label: t('dashboard.reviewRegistrations'), icon: ClipboardCheck });
    }
    return actions.filter((action) => {
      if (action.to === '/treatments/new') return can('treatment:write');
      if (action.to === '/inventory') return can('inventory:write');
      if (action.to === '/registrations') return can('registration:review');
      return can('report:export');
    });
  }, [can, role, t]);

  const roleSubtitle =
    role === 'DSA_ADMIN'
      ? t('dashboard.subtitle.dsa')
      : role === 'CHAMBER_ADMIN'
        ? t('dashboard.subtitle.chamber')
        : t('dashboard.subtitle.farmer');

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.overview')}
        title={t('dashboard.title')}
        subtitle={roleSubtitle}
        actions={<DemoBadge />}
      />

      <AlertBanner tone="info" className="mb-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold">{t('dashboard.demoWelcome', { name: data.user.fullName })}</span>
          <span>{t('dashboard.demoBannerText')}</span>
          {season ? (
            <Badge tone="green">
              {t('dashboard.activeSeason')}: {season.label}
            </Badge>
          ) : null}
        </div>
      </AlertBanner>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const content = (
            <StatCard
              key={card.key}
              label={card.label}
              value={card.value}
              hint={card.hint}
              icon={card.icon}
              tone={card.tone}
            />
          );
          return card.to ? (
            <Link key={card.key} to={card.to} className="block rounded-2xl transition hover:-translate-y-0.5">
              {content}
            </Link>
          ) : (
            content
          );
        })}
      </div>

      {quickActions.length > 0 ? (
        <Card className="mt-5">
          <SectionTitle hint={t('app.roleSimulation')}>{t('dashboard.quickActions')}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link key={action.to + action.label} to={action.to}>
                <Button variant="secondary" size="sm" icon={action.icon}>
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            icon={TrendingUp}
            title={t('dashboard.treatmentTrend')}
            subtitle={t('dashboard.treatmentTrendHint')}
            action={
              <Badge tone="slate">
                {season?.label ?? t('common.allSeasons')}
              </Badge>
            }
          />
          <TrendChart data={trend} language={language} emptyLabel={t('dashboard.noTrend')} />
        </Card>

        <Card>
          <CardHeader
            icon={Leaf}
            title={t('dashboard.cropSummary')}
            subtitle={t('dashboard.cropSummaryHint')}
          />
          {cropChart.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-500">{t('dashboard.noCrops')}</p>
          ) : (
            <>
              <div className="h-44 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cropChart}
                      dataKey="area"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {cropChart.map((entry, index) => (
                        <Cell key={entry.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${formatNumber(Number(value), language)} ha`, '']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e9eceb', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-1 space-y-1.5">
                {cropChart.map((entry, index) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="truncate text-ink-700">{entry.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-ink-800">
                      {formatArea(entry.area, language)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader
            icon={Gauge}
            title={t('dashboard.tfiSummary')}
            subtitle={t('dashboard.tfiSummaryHint')}
            action={<Link to="/tfi" className="text-xs font-semibold text-forest-700 hover:underline">{t('common.viewAll')}</Link>}
          />
          <div className="mb-3 rounded-xl border border-clay-200 bg-clay-50/70 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-clay-900">
              {t('tfi.provisionalBadge')}
            </p>
            <p className="mt-0.5 text-xs text-ink-600">
              {t('tfi.methodologyVersion')}: {data.tfiConfig.version} · demo-1.0
            </p>
          </div>
          {averageTfi === null ? (
            <p className="py-6 text-center text-sm text-ink-500">{t('dashboard.tfiEmpty')}</p>
          ) : (
            <p className="mb-3 font-display text-3xl font-bold text-forest-900">
              {formatNumber(averageTfi, language, 3)}
            </p>
          )}
          <ul className="space-y-2">
            {tfiCrops.map(({ crop, result }) => (
              <li key={crop.id} className="flex items-center justify-between gap-2 border-t border-ink-100 pt-2 text-xs">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink-800">{crop.name}</span>
                  <span className="text-ink-500">
                    {result.treatmentCount} {t('tfi.treatments')}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {result.status === 'INCOMPLETE' ? <Badge tone="amber">{t('status.INCOMPLETE')}</Badge> : null}
                  <span className="font-mono font-semibold text-ink-900">
                    {formatNumber(result.value, language, 3)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            icon={PackageSearch}
            title={t('dashboard.lowStock')}
            subtitle={t('dashboard.lowStockHint')}
            action={<Link to="/inventory" className="text-xs font-semibold text-forest-700 hover:underline">{t('common.viewAll')}</Link>}
          />
          {lowStockLines.length === 0 ? (
            <EmptyState compact icon={Boxes} title={t('dashboard.lowStock')} description={t('inventory.noProductStock')} />
          ) : (
            <ul className="space-y-2">
              {lowStockLines.map((line) => (
                <li key={line.key} className="flex items-start justify-between gap-2 border-b border-ink-100 pb-2 last:border-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink-800">{line.productName}</span>
                    <span className="block truncate text-xs text-ink-500">{line.holdingName}</span>
                  </span>
                  <Badge tone={line.balance <= 0 ? 'red' : 'amber'}>
                    {formatNumber(line.balance, language)} {line.unit}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            icon={ShieldAlert}
            title={t('dashboard.openAlerts')}
            subtitle={t('dashboard.alertsAttention', { count: openAlerts.length })}
            action={<Link to="/alerts" className="text-xs font-semibold text-forest-700 hover:underline">{t('common.viewAll')}</Link>}
          />
          {openAlerts.length === 0 ? (
            <EmptyState compact icon={ShieldAlert} title={t('dashboard.noAlerts')} />
          ) : (
            <ul className="space-y-2">
              {openAlerts.slice(0, 4).map((alert) => (
                <li key={alert.id} className="rounded-lg border border-ink-100 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={severityTone(alert.severity)}>{t(`severity.${alert.severity}`)}</Badge>
                    {!alert.read ? <span className="h-2 w-2 rounded-full bg-clay-500" aria-hidden /> : null}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-ink-800">{alertTitle(t, alert)}</p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-500">{alertDescription(t, alert)}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-ink-400">
            {unreadAlerts.length} {t('notifications.unread')} · {openAlerts.length} {t('alerts.tabActive')}
          </p>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            icon={SprayCan}
            title={t('dashboard.recentTreatments')}
            subtitle={t('dashboard.recentTreatmentsHint')}
            action={<Link to="/treatments" className="text-xs font-semibold text-forest-700 hover:underline">{t('common.viewAll')}</Link>}
          />
          {seasonTreatments.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">{t('dashboard.noTreatments')}</p>
          ) : (
            <TableWrap>
              <TableHead>
                <TableRow>
                  <TableTh>{t('treatments.table.date')}</TableTh>
                  <TableTh>{t('treatments.table.crop')}</TableTh>
                  <TableTh>{t('treatments.table.product')}</TableTh>
                  <TableTh>{t('treatments.table.area')}</TableTh>
                </TableRow>
              </TableHead>
              <TableBody>
                {seasonTreatments.slice(0, 5).map((treatment) => {
                  const crop = data.crops.find((item) => item.id === treatment.cropId);
                  const product = data.pesticides.find((item) => item.id === treatment.productId);
                  return (
                    <TableRow key={treatment.id}>
                      <TableTd className="whitespace-nowrap">{formatDate(treatment.treatmentDate, language)}</TableTd>
                      <TableTd>
                        <Link to={`/treatments/${treatment.id}`} className="font-semibold text-forest-800 hover:underline">
                          {crop?.name ?? treatment.cropId}
                        </Link>
                      </TableTd>
                      <TableTd>{product?.commercialName ?? treatment.productId}</TableTd>
                      <TableTd>{formatArea(treatment.treatedAreaHa, language)}</TableTd>
                    </TableRow>
                  );
                })}
              </TableBody>
            </TableWrap>
          )}
        </Card>

        {role === 'DSA_ADMIN' ? (
          <Card>
            <CardHeader
              icon={Activity}
              title={t('dashboard.recentActivity')}
              subtitle={t('dashboard.recentActivityHint')}
              action={<Link to="/audit" className="text-xs font-semibold text-forest-700 hover:underline">{t('common.viewAll')}</Link>}
            />
            {data.auditLog.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-500">{t('dashboard.noActivity')}</p>
            ) : (
              <ul className="space-y-2.5">
                {data.auditLog.slice(0, 6).map((event) => (
                  <li key={event.id} className="flex items-start gap-2.5 border-b border-ink-100 pb-2.5 last:border-0 last:pb-0">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-forest-700">
                      <Activity size={13} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-ink-800">{event.summary}</span>
                      <span className="block text-[11px] text-ink-500">
                        {event.actorName} · {formatDateTime(event.timestamp, language)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card>
            <CardHeader
              icon={Boxes}
              title={t('dashboard.recentMovements')}
              subtitle={t('dashboard.recentMovementsHint')}
              action={<Link to="/inventory" className="text-xs font-semibold text-forest-700 hover:underline">{t('common.viewAll')}</Link>}
            />
            {data.inventoryMovements.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-500">{t('dashboard.noMovements')}</p>
            ) : (
              <ul className="space-y-2.5">
                {data.inventoryMovements
                  .slice()
                  .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                  .slice(0, 6)
                  .map((movement) => {
                    const product = data.pesticides.find((item) => item.id === movement.productId);
                    return (
                      <li key={movement.id} className="flex items-center justify-between gap-2 border-b border-ink-100 pb-2 last:border-0 last:pb-0">
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-ink-800">
                            {product?.commercialName ?? movement.productId}
                          </span>
                          <span className="text-[11px] text-ink-500">
                            {t(`movementType.${movement.type}`)} · {formatDate(movement.occurredAt, language)}
                          </span>
                        </span>
                        <Badge tone={movement.status === 'ACTIVE' ? 'green' : 'red'}>
                          {formatNumber(movement.quantity, language)} {movement.unit}
                        </Badge>
                      </li>
                    );
                  })}
              </ul>
            )}
          </Card>
        )}
      </div>

      <Card className="mt-5">
        <CardHeader icon={Building2} title={t('dashboard.scope')} subtitle={t('dashboard.demoBannerText')} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KeyValue label={t('field.role')}>{t(`role.${role}`)}</KeyValue>
          <KeyValue label={t('common.scope')}>
            {data.scopeCommunes?.length
              ? data.scopeCommunes.join(', ')
              : role === 'FARMER'
                ? data.farmers.find((farmer) => farmer.id === data.farmerId)?.commune ?? '—'
                : t('role.scope.province')}
          </KeyValue>
          <KeyValue label={t('dashboard.productsCount')}>{formatNumber(data.pesticides.filter((product) => !product.archived).length, language, 0)}</KeyValue>
          <KeyValue label={t('dashboard.stockLines')}>{formatNumber(stockLines.length, language, 0)}</KeyValue>
        </div>
      </Card>

    </div>
  );
}
