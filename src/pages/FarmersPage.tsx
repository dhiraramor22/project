import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { statusTone } from '../app/status';
import { formatArea } from '../domain/format';
import { useI18n } from '../i18n';
import { FarmerFormModal } from '../components/farmers/FarmerFormModal';
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
} from '../components/ui/primitives';

export function FarmersPage() {
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { can, refresh } = useWorkspace();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [commune, setCommune] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.farmers
      .filter((farmer) => status === 'all' || farmer.status === status)
      .filter((farmer) => commune === 'all' || farmer.commune === commune)
      .filter((farmer) => {
        if (!term) return true;
        return [farmer.fullName, farmer.commune, farmer.email, farmer.phone]
          .some((value) => value.toLowerCase().includes(term));
      })
      .map((farmer) => {
        const holdings = data.holdings.filter((holding) => holding.ownerFarmerId === farmer.id);
        const area = holdings.reduce((sum, holding) => sum + holding.totalCultivatedAreaHa, 0);
        return { farmer, holdings, area };
      })
      .sort((a, b) => a.farmer.fullName.localeCompare(b.farmer.fullName));
  }, [commune, data.farmers, data.holdings, search, status]);

  const communes = useMemo(
    () => [...new Set([...data.settings.communes, ...data.farmers.map((farmer) => farmer.commune)])].sort(),
    [data.farmers, data.settings.communes],
  );

  return (
    <div>
      <PageHeader
        title={t('farmers.title')}
        subtitle={t('farmers.subtitle')}
        eyebrow={t('nav.section.oversight')}
        actions={
          can('farmer:create') ? (
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>
              {t('farmers.add')}
            </Button>
          ) : undefined
        }
      />

      <AlertBanner tone="info" className="mb-5">
        {data.role === 'CHAMBER_ADMIN'
          ? t('role.CHAMBER_ADMIN_notice')
          : t('farmers.detail.invitationNote')}
      </AlertBanner>

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('common.search')} htmlFor="farmer-search">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                id="farmer-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('farmers.searchPlaceholder')}
                className="w-full rounded-lg border border-ink-200 bg-white py-2 pe-3 ps-9 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
              />
            </div>
          </Field>
          <Field label={t('farmers.statusFilter')} htmlFor="farmer-status">
            <Select id="farmer-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">{t('common.allStatuses')}</option>
              <option value="APPROVED">{t('status.APPROVED')}</option>
              <option value="PENDING">{t('status.PENDING')}</option>
              <option value="SUSPENDED">{t('status.SUSPENDED')}</option>
              <option value="REJECTED">{t('status.REJECTED')}</option>
            </Select>
          </Field>
          <Field label={t('farmers.table.commune')} htmlFor="farmer-commune">
            <Select id="farmer-commune" value={commune} onChange={(event) => setCommune(event.target.value)}>
              <option value="all">{t('common.all')}</option>
              {communes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title={t('farmers.emptyTitle')} description={t('farmers.emptyText')} />
      ) : (
        <TableWrap>
          <TableHead>
            <TableRow>
              <TableTh>{t('farmers.table.farmer')}</TableTh>
              <TableTh>{t('farmers.table.commune')}</TableTh>
              <TableTh>{t('farmers.table.contact')}</TableTh>
              <TableTh>{t('farmers.table.status')}</TableTh>
              <TableTh>{t('farmers.table.holdings')}</TableTh>
              <TableTh>{t('farmers.table.area')}</TableTh>
              <TableTh>{t('farmers.table.actions')}</TableTh>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(({ farmer, holdings, area }) => (
              <TableRow key={farmer.id}>
                <TableTd>
                  <Link to={`/farmers/${farmer.id}`} className="font-semibold text-forest-800 hover:underline">
                    {farmer.fullName}
                  </Link>
                  <span className="block text-xs text-ink-500">{farmer.id}</span>
                </TableTd>
                <TableTd>{farmer.commune}</TableTd>
                <TableTd>
                  <span className="block text-xs text-ink-600">{farmer.email}</span>
                  <span className="block text-xs text-ink-500">{farmer.phone}</span>
                </TableTd>
                <TableTd>
                  <Badge tone={statusTone(farmer.status)}>{t(`status.${farmer.status}`)}</Badge>
                </TableTd>
                <TableTd>{holdings.length}</TableTd>
                <TableTd>{formatArea(area, language)}</TableTd>
                <TableTd>
                  <Link
                    to={`/farmers/${farmer.id}`}
                    className="text-xs font-semibold text-forest-700 hover:underline"
                  >
                    {t('common.viewDetails')}
                  </Link>
                </TableTd>
              </TableRow>
            ))}
          </TableBody>
        </TableWrap>
      )}

      <FarmerFormModal
        mode="create"
        open={createOpen}
        communes={data.settings.communes}
        onClose={() => setCreateOpen(false)}
        onSaved={async () => {
          await refresh();
        }}
      />
    </div>
  );
}
