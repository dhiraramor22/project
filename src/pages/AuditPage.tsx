import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  FileBarChart2,
  Filter,
  ScrollText,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useWorkspaceData } from '../app/WorkspaceProvider';
import { roleTone } from '../app/status';
import { formatDateTime } from '../domain/format';
import type { AuditEvent } from '../domain/types';
import { useI18n } from '../i18n';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  DemoBadge,
  EmptyState,
  Field,
  Input,
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

const PAGE_SIZE = 50;

export function AuditPage() {
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const actions = useMemo(
    () => [...new Set(data.auditLog.map((event) => event.action))].sort(),
    [data.auditLog],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.auditLog
      .filter((event) => {
        if (action !== 'all' && event.action !== action) return false;
        if (from && event.timestamp.slice(0, 10) < from) return false;
        if (to && event.timestamp.slice(0, 10) > to) return false;
        if (!term) return true;
        return [
          event.actorName,
          event.actorId,
          event.action,
          event.entityType,
          event.entityId,
          event.summary,
          event.role,
        ]
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .slice()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [data.auditLog, action, from, to, search]);

  const resetFilters = () => {
    setSearch('');
    setAction('all');
    setFrom('');
    setTo('');
    setVisible(PAGE_SIZE);
  };

  const metadataEntries = selected?.metadata ? Object.entries(selected.metadata) : [];

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.section.oversight')}
        title={t('audit.title')}
        subtitle={t('audit.subtitle')}
        actions={
          <>
            <Link to="/reports">
              <Button variant="secondary" icon={FileBarChart2}>
                {t('nav.reports')}
              </Button>
            </Link>
            <DemoBadge />
          </>
        }
      />

      <AlertBanner tone="warning" className="mb-5" title={t('audit.notTamperProof')}>
        <p>{t('audit.exportNote')}</p>
      </AlertBanner>

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label={t('common.search')} htmlFor="audit-search">
            <Input
              id="audit-search"
              value={search}
              placeholder={t('audit.searchPlaceholder')}
              onChange={(event) => {
                setSearch(event.target.value);
                setVisible(PAGE_SIZE);
              }}
            />
          </Field>
          <Field label={t('audit.filterAction')} htmlFor="audit-action">
            <Select
              id="audit-action"
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setVisible(PAGE_SIZE);
              }}
            >
              <option value="all">{t('audit.allActions')}</option>
              {actions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('common.from')} htmlFor="audit-from">
            <Input
              id="audit-from"
              type="date"
              max={to || undefined}
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setVisible(PAGE_SIZE);
              }}
            />
          </Field>
          <Field label={t('common.to')} htmlFor="audit-to">
            <Input
              id="audit-to"
              type="date"
              min={from || undefined}
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setVisible(PAGE_SIZE);
              }}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
          <span>
            {t('common.showingRecords', {
              count: Math.min(visible, filtered.length),
              total: filtered.length,
            })}
          </span>
          <button type="button" onClick={resetFilters} className="font-semibold text-forest-700 hover:underline">
            {t('common.clearFilters')}
          </button>
        </div>
      </Card>

      <Card padded={false}>
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={ScrollText}
              title={t('audit.emptyTitle')}
              description={t('audit.emptyText')}
            />
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <TableWrap>
              <TableHead>
                <TableRow>
                  <TableTh>{t('audit.timestamp')}</TableTh>
                  <TableTh>{t('audit.actor')}</TableTh>
                  <TableTh>{t('audit.role')}</TableTh>
                  <TableTh>{t('audit.action')}</TableTh>
                  <TableTh>{t('audit.entity')}</TableTh>
                  <TableTh>{t('audit.summary')}</TableTh>
                  <TableTh>{t('common.actions')}</TableTh>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.slice(0, visible).map((event) => (
                  <TableRow key={event.id}>
                    <TableTd className="whitespace-nowrap text-xs">
                      {formatDateTime(event.timestamp, language)}
                    </TableTd>
                    <TableTd className="text-xs">
                      <span className="block font-semibold text-ink-800">{event.actorName}</span>
                      <span className="font-mono text-[10px] text-ink-400">{event.actorId}</span>
                    </TableTd>
                    <TableTd>
                      <Badge tone={roleTone(event.role)}>{t(`role.${event.role}`)}</Badge>
                    </TableTd>
                    <TableTd>
                      <span className="rounded bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-700">
                        {event.action}
                      </span>
                    </TableTd>
                    <TableTd className="whitespace-nowrap text-xs">
                      <span className="block text-ink-700">{event.entityType}</span>
                      <span className="font-mono text-[10px] text-ink-400">{event.entityId}</span>
                    </TableTd>
                    <TableTd className="max-w-sm text-xs">{event.summary}</TableTd>
                    <TableTd>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => setSelected(event)}
                      >
                        {t('common.details')}
                      </Button>
                    </TableTd>
                  </TableRow>
                ))}
              </TableBody>
            </TableWrap>
            {visible < filtered.length ? (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Filter}
                  onClick={() => setVisible((current) => current + PAGE_SIZE)}
                >
                  {t('common.showMore')}
                </Button>
              </div>
            ) : null}
            <p className="mt-3 text-[11px] text-ink-400">
              {t('audit.showingRecent', { count: Math.min(visible, filtered.length) })} ·{' '}
              {t('audit.retentionNote')}
            </p>
          </div>
        )}
      </Card>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-[11px] leading-relaxed text-ink-500">
        <ShieldAlert size={14} className="mt-0.5 shrink-0 text-clay-600" aria-hidden />
        <p>{t('audit.notTamperProof')}</p>
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={t('audit.detailsTitle')}
        description={selected ? `${selected.action} · ${formatDateTime(selected.timestamp, language)}` : undefined}
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setSelected(null)} icon={X}>
            {t('common.close')}
          </Button>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('audit.actor')}</dt>
                <dd className="mt-0.5 text-sm text-ink-800">
                  {selected.actorName}{' '}
                  <span className="font-mono text-xs text-ink-400">({selected.actorId})</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('audit.role')}</dt>
                <dd className="mt-0.5">
                  <Badge tone={roleTone(selected.role)}>{t(`role.${selected.role}`)}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('audit.action')}</dt>
                <dd className="mt-0.5 font-mono text-sm text-ink-800">{selected.action}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('audit.entity')}</dt>
                <dd className="mt-0.5 text-sm text-ink-800">
                  {selected.entityType} <span className="font-mono text-xs text-ink-400">({selected.entityId})</span>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('audit.summary')}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink-800">{selected.summary}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('audit.timestamp')}</dt>
                <dd className="mt-0.5 text-sm text-ink-800">{formatDateTime(selected.timestamp, language)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('common.id')}</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-ink-500">{selected.id}</dd>
              </div>
            </dl>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-600">{t('audit.metadata')}</h3>
              {metadataEntries.length === 0 ? (
                <p className="rounded-lg border border-dashed border-ink-200 px-3 py-4 text-sm text-ink-500">
                  {t('audit.noDetails')}
                </p>
              ) : (
                <TableWrap>
                  <TableHead>
                    <TableRow>
                      <TableTh>{t('common.name')}</TableTh>
                      <TableTh>{t('common.details')}</TableTh>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {metadataEntries.map(([key, value]) => (
                      <TableRow key={key}>
                        <TableTd className="font-mono text-xs">{key}</TableTd>
                        <TableTd className="break-all font-mono text-xs">
                          {value === null ? '—' : String(value)}
                        </TableTd>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableWrap>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
