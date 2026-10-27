import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  CheckCheck,
  CheckCircle2,
  Eye,
  Filter,
  ShieldAlert,
} from 'lucide-react';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { alertDescription, alertEntityLink, alertTitle, severityTone } from '../app/status';
import { useAction } from '../app/useAction';
import { formatDateTime } from '../domain/format';
import type { Alert, AlertCategory } from '../domain/types';
import { useI18n } from '../i18n';
import { repository } from '../repositories';
import { ReasonModal } from '../components/common/ReasonModal';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  DemoBadge,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Tabs,
  Tab,
  cx,
} from '../components/ui/primitives';

const CATEGORIES: AlertCategory[] = [
  'LOW_STOCK',
  'PENDING_REGISTRATION',
  'INCOMPLETE_TREATMENT',
  'UNVERIFIED_REFERENCE_DOSE',
  'AREA_MISMATCH',
  'INSUFFICIENT_STOCK',
];

type TabValue = 'active' | 'unread' | 'resolved' | 'all';

export function AlertsPage() {
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { refresh } = useWorkspace();
  const { busy, error, run } = useAction();
  const [tab, setTab] = useState<TabValue>('active');
  const [category, setCategory] = useState('all');
  const [resolveTarget, setResolveTarget] = useState<Alert | null>(null);

  const alerts = data.alerts;
  const activeCount = alerts.filter((alert) => !alert.resolved).length;
  const resolvedCount = alerts.filter((alert) => alert.resolved).length;
  const unreadCount = alerts.filter((alert) => !alert.read && !alert.resolved).length;
  const criticalCount = alerts.filter((alert) => !alert.resolved && alert.severity === 'CRITICAL').length;

  const filtered = useMemo(() => {
    return alerts
      .filter((alert) => {
        if (tab === 'active') return !alert.resolved;
        if (tab === 'unread') return !alert.read && !alert.resolved;
        if (tab === 'resolved') return alert.resolved;
        return true;
      })
      .filter((alert) => category === 'all' || alert.category === category)
      .slice()
      .sort((a, b) => {
        if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
        const bySeverity = severityRank(b.severity) - severityRank(a.severity);
        if (bySeverity !== 0) return bySeverity;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [alerts, tab, category]);

  const markRead = async (alert: Alert) => {
    await run(`read-${alert.id}`, () => repository.markAlertRead(alert.id), {
      success: t('alerts.readToast'),
      onSuccess: refresh,
    });
  };

  const markAll = async () => {
    await run('read-all', () => repository.markAllAlertsRead(), {
      success: t('alerts.allRead'),
      onSuccess: refresh,
    });
  };

  const resolve = async (notes: string) => {
    if (!resolveTarget) return;
    await run(
      `resolve-${resolveTarget.id}`,
      () => repository.resolveAlert(resolveTarget.id, notes.trim() || undefined),
      {
        success: t('alerts.resolvedToast'),
        onSuccess: async () => {
          setResolveTarget(null);
          await refresh();
        },
      },
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.section.oversight')}
        title={t('alerts.title')}
        subtitle={t('alerts.subtitle')}
        actions={
          <>
            <Button
              variant="outline"
              icon={CheckCheck}
              onClick={() => void markAll()}
              loading={busy === 'read-all'}
              disabled={unreadCount === 0}
            >
              {t('alerts.markAllRead')}
            </Button>
            <DemoBadge />
          </>
        }
      />

      <AlertBanner tone="info" className="mb-5">
        {t('alerts.autoResolveNote')} {t('alerts.resolveNote')}
      </AlertBanner>

      {error ? (
        <AlertBanner tone="danger" className="mb-4" title={t('common.error')}>
          {error}
        </AlertBanner>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
            <ShieldAlert size={19} aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {t('alerts.tabActive')}
            </p>
            <p className="font-display text-xl font-bold text-ink-900">{activeCount}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-700">
            <BellRing size={19} aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {t('alerts.severity')} · {t('severity.CRITICAL')}
            </p>
            <p className="font-display text-xl font-bold text-ink-900">{criticalCount}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Eye size={19} aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {t('common.unread')}
            </p>
            <p className="font-display text-xl font-bold text-ink-900">{unreadCount}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
            <CheckCircle2 size={19} aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {t('alerts.tabResolved')}
            </p>
            <p className="font-display text-xl font-bold text-ink-900">{resolvedCount}</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as TabValue)}
            className="flex-1"
          >
            <Tab value="active">{t('alerts.tabActive')} ({activeCount})</Tab>
            <Tab value="unread">{t('alerts.unreadOnly')} ({unreadCount})</Tab>
            <Tab value="resolved">{t('alerts.tabResolved')} ({resolvedCount})</Tab>
            <Tab value="all">{t('alerts.tabAll')}</Tab>
          </Tabs>
          <Field label={t('alerts.categoryFilter')} htmlFor="alert-category" className="w-full sm:w-64">
            <div className="relative">
              <Filter
                size={14}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <Select
                id="alert-category"
                className="ps-8"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="all">{t('alerts.allCategories')}</option>
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {t(`alerts.category.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
        </div>

        <div className="mt-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title={t('alerts.emptyTitle')}
              description={t('alerts.emptyText')}
            />
          ) : (
            <ul className="space-y-3">
              {filtered.map((alert) => {
                const link = alertEntityLink(alert);
                const alertBusy =
                  busy === `read-${alert.id}` || busy === `resolve-${alert.id}`;
                return (
                  <li
                    key={alert.id}
                    className={cx(
                      'rounded-xl border p-4 transition',
                      alert.resolved
                        ? 'border-ink-100 bg-ink-50/40'
                        : alert.severity === 'CRITICAL'
                          ? 'border-red-200 bg-red-50/40'
                          : alert.severity === 'WARNING'
                            ? 'border-amber-200 bg-amber-50/30'
                            : 'border-sky-100 bg-sky-50/20',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={severityTone(alert.severity)}>
                            {t(`severity.${alert.severity}`)}
                          </Badge>
                          <Badge tone="slate">{t(`alerts.category.${alert.category}`)}</Badge>
                          {!alert.read && !alert.resolved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-clay-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-clay-500" aria-hidden />
                              {t('common.unread')}
                            </span>
                          ) : null}
                          {alert.resolved ? (
                            <Badge tone="green">{t('common.resolved')}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-ink-900">
                          {alertTitle(t, alert)}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-ink-600">
                          {alertDescription(t, alert)}
                        </p>
                        <p className="mt-1.5 text-[11px] text-ink-400">
                          {t('alerts.detected')}: {formatDateTime(alert.updatedAt, language)}
                          {alert.resolvedAt
                            ? ` · ${t('common.resolved')}: ${formatDateTime(alert.resolvedAt, language)}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {link ? (
                          <Link to={link}>
                            <Button size="sm" variant="outline" icon={Eye}>
                              {t('alerts.openRecord')}
                            </Button>
                          </Link>
                        ) : null}
                        {!alert.read && !alert.resolved ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={CheckCircle2}
                            onClick={() => void markRead(alert)}
                            loading={busy === `read-${alert.id}`}
                          >
                            {t('alerts.markRead')}
                          </Button>
                        ) : null}
                        {!alert.resolved ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={CheckCheck}
                            onClick={() => setResolveTarget(alert)}
                            loading={busy === `resolve-${alert.id}`}
                            disabled={alertBusy}
                          >
                            {t('alerts.resolve')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
          {t('alerts.resolutionAutomatic')} · {t('alerts.resolveNote')}
        </p>
      </Card>

      <ReasonModal
        open={Boolean(resolveTarget)}
        onClose={() => setResolveTarget(null)}
        onConfirm={resolve}
        title={t('alerts.resolveTitle')}
        description={t('alerts.resolveText')}
        label={t('alerts.resolveNotes')}
        confirmLabel={t('alerts.resolve')}
        requireReason={false}
        tone="primary"
        busy={resolveTarget ? busy === `resolve-${resolveTarget.id}` : false}
      />
    </div>
  );
}

function severityRank(severity: Alert['severity']): number {
  if (severity === 'CRITICAL') return 3;
  if (severity === 'WARNING') return 2;
  return 1;
}
