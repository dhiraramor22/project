import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Plus, Search, Sprout } from 'lucide-react';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { statusTone } from '../app/status';
import { formatArea } from '../domain/format';
import { useI18n } from '../i18n';
import { HoldingFormModal } from '../components/holdings/HoldingFormModal';
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

export function HoldingsPage() {
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { can, refresh } = useWorkspace();
  const [search, setSearch] = useState('');
  const [commune, setCommune] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const farmerNames = useMemo(
    () => new Map(data.farmers.map((farmer) => [farmer.id, farmer.fullName])),
    [data.farmers],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.holdings
      .filter((holding) => commune === 'all' || holding.commune === commune)
      .filter((holding) => {
        if (!term) return true;
        return [holding.name, holding.commune, farmerNames.get(holding.ownerFarmerId)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .map((holding) => ({
        holding,
        plots: data.plots.filter((plot) => plot.holdingId === holding.id),
        crops: data.crops.filter((crop) => crop.holdingId === holding.id),
      }))
      .sort((a, b) => a.holding.name.localeCompare(b.holding.name));
  }, [commune, data.crops, data.holdings, data.plots, farmerNames, search]);

  const communes = useMemo(
    () => [...new Set([...data.settings.communes, ...data.holdings.map((holding) => holding.commune)])].sort(),
    [data.holdings, data.settings.communes],
  );

  return (
    <div>
      <PageHeader
        title={t('holdings.title')}
        subtitle={t('holdings.subtitle')}
        eyebrow={t('nav.section.operations')}
        actions={
          can('holding:write') ? (
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>
              {t('holdings.add')}
            </Button>
          ) : undefined
        }
      />

      <AlertBanner tone="info" className="mb-5">
        {t('holdings.areaCheckNote')}
      </AlertBanner>

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('common.search')} htmlFor="holding-search">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                id="holding-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('holdings.searchPlaceholder')}
                className="w-full rounded-lg border border-ink-200 bg-white py-2 pe-3 ps-9 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
              />
            </div>
          </Field>
          <Field label={t('holdings.communeFilter')} htmlFor="holding-commune">
            <Select id="holding-commune" value={commune} onChange={(event) => setCommune(event.target.value)}>
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
        <EmptyState
          icon={Sprout}
          title={t('holdings.emptyTitle')}
          description={t('holdings.emptyText')}
          action={
            can('holding:write') ? (
              <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                {t('holdings.add')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TableWrap>
          <TableHead>
            <TableRow>
              <TableTh>{t('holdings.detail')}</TableTh>
              <TableTh>{t('field.owner')}</TableTh>
              <TableTh>{t('field.commune')}</TableTh>
              <TableTh>{t('common.area')}</TableTh>
              <TableTh>{t('holdings.plots')}</TableTh>
              <TableTh>{t('holdings.crops')}</TableTh>
              <TableTh>{t('common.status')}</TableTh>
              <TableTh>{t('common.actions')}</TableTh>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(({ holding, plots, crops }) => {
              const plotArea = plots.reduce((sum, plot) => sum + plot.areaHa, 0);
              return (
                <TableRow key={holding.id}>
                  <TableTd>
                    <Link to={`/holdings/${holding.id}`} className="font-semibold text-forest-800 hover:underline">
                      {holding.name}
                    </Link>
                    <span className="block text-xs text-ink-500">
                      {holding.latitude !== undefined
                        ? `${holding.latitude.toFixed(4)}, ${holding.longitude?.toFixed(4)}`
                        : t('holdings.noCoordinates')}
                    </span>
                  </TableTd>
                  <TableTd>{farmerNames.get(holding.ownerFarmerId) ?? '—'}</TableTd>
                  <TableTd>{holding.commune}</TableTd>
                  <TableTd>
                    <span className="block">{formatArea(holding.totalCultivatedAreaHa, language)}</span>
                    {plotArea > holding.totalCultivatedAreaHa + 0.0001 ? (
                      <Badge tone="amber" className="mt-1">
                        {t('holdings.areaExceeded')}
                      </Badge>
                    ) : null}
                  </TableTd>
                  <TableTd>{plots.length}</TableTd>
                  <TableTd>{crops.length}</TableTd>
                  <TableTd>
                    <Badge tone={statusTone(holding.status)}>{t(`status.${holding.status}`)}</Badge>
                  </TableTd>
                  <TableTd>
                    <Link to={`/holdings/${holding.id}`}>
                      <Button size="sm" variant="outline" icon={MapPin}>
                        {t('holdings.manage')}
                      </Button>
                    </Link>
                  </TableTd>
                </TableRow>
              );
            })}
          </TableBody>
        </TableWrap>
      )}

      <HoldingFormModal
        open={createOpen}
        farmers={data.farmers}
        communes={data.settings.communes}
        canChooseOwner={data.role !== 'FARMER'}
        onClose={() => setCreateOpen(false)}
        onSaved={async () => {
          await refresh();
        }}
      />
    </div>
  );
}
