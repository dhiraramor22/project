import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import {
  ExternalLink,
  List,
  Map as MapIcon,
  MapPinOff,
  MapPinned,
  Search,
  Sprout,
  TriangleAlert,
} from 'lucide-react';
import { useWorkspaceData } from '../app/WorkspaceProvider';
import { formatArea, formatNumber } from '../domain/format';
import type { AgriculturalHolding } from '../domain/types';
import { useI18n } from '../i18n';
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
  KeyValue,
  PageHeader,
  Select,
  Tab,
  TableBody,
  TableHead,
  TableRow,
  TableTd,
  TableTh,
  TableWrap,
  Tabs,
} from '../components/ui/primitives';

type MapTab = 'map' | 'list';

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 10));
      return;
    }
    map.fitBounds(points, { padding: [30, 30], maxZoom: 12 });
  }, [map, points]);
  return null;
}

class MapErrorBoundary extends Component<{ children: ReactNode; title: string; text: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <AlertBanner tone="warning" title={this.props.title}>
          {this.props.text}
        </AlertBanner>
      );
    }
    return this.props.children;
  }
}

export function MapPage() {
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const [search, setSearch] = useState('');
  const [commune, setCommune] = useState('all');
  const [tab, setTab] = useState<MapTab>('map');

  const communes = useMemo(
    () => [...new Set(data.holdings.map((holding) => holding.commune))].sort(),
    [data.holdings],
  );

  const farmerNames = useMemo(
    () => new Map(data.farmers.map((farmer) => [farmer.id, farmer.fullName])),
    [data.farmers],
  );

  const cropNames = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const crop of data.crops) {
      const current = map.get(crop.holdingId) ?? [];
      current.push(crop.name);
      map.set(crop.holdingId, current);
    }
    return map;
  }, [data.crops]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.holdings.filter((holding) => {
      if (commune !== 'all' && holding.commune !== commune) return false;
      if (!term) return true;
      const owner = farmerNames.get(holding.ownerFarmerId) ?? '';
      return `${holding.name} ${holding.commune} ${owner}`.toLowerCase().includes(term);
    });
  }, [data.holdings, commune, search, farmerNames]);

  const mapped = filtered.filter(
    (holding) => holding.latitude !== undefined && holding.longitude !== undefined,
  );
  const missing = filtered.filter(
    (holding) => holding.latitude === undefined || holding.longitude === undefined,
  );

  const points = useMemo(
    () =>
      mapped.map(
        (holding) => [holding.latitude as number, holding.longitude as number] as [number, number],
      ),
    [mapped],
  );

  const center = data.settings.mapCenter;
  const demoCoordinates = mapped.some((holding) => holding.coordinatesAreDemo);

  const holdingCrops = (holding: AgriculturalHolding) => cropNames.get(holding.id) ?? [];

  const resetFilters = () => {
    setSearch('');
    setCommune('all');
  };

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.section.oversight')}
        title={t('map.title')}
        subtitle={t('map.subtitle')}
        actions={<DemoBadge />}
      />

      <AlertBanner tone="warning" className="mb-4" title={t('map.demoCoordinates')}>
        <p>{t('map.demoCoordinatesText')}</p>
      </AlertBanner>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('map.withCoordinates')}</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink-900">
            {formatNumber(mapped.length, language, 0)}
          </p>
          <p className="mt-1 text-xs text-ink-500">{t('map.holdingsCount', { count: mapped.length })}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('map.withoutCoordinates')}</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink-900">
            {formatNumber(missing.length, language, 0)}
          </p>
          <p className="mt-1 text-xs text-ink-500">{t('map.coordinatesHint')}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('common.total')}</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink-900">
            {formatNumber(filtered.length, language, 0)}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {formatArea(
              filtered.reduce((sum, holding) => sum + holding.totalCultivatedAreaHa, 0),
              language,
            )}
          </p>
        </Card>
      </div>

      <Card className="mt-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('common.search')} htmlFor="map-search">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <Input
                id="map-search"
                className="ps-8"
                value={search}
                placeholder={t('map.searchPlaceholder')}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </Field>
          <Field label={t('map.communeFilter')} htmlFor="map-commune">
            <Select
              id="map-commune"
              value={commune}
              onChange={(event) => setCommune(event.target.value)}
            >
              <option value="all">{t('map.allCommunes')}</option>
              {communes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end justify-start gap-2 lg:justify-end">
            <Button variant="outline" size="sm" onClick={resetFilters} icon={Search}>
              {t('common.clearFilters')}
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-5">
        <Tabs value={tab} onChange={(value) => setTab(value as MapTab)}>
          <Tab value="map">
            <span className="inline-flex items-center gap-1.5">
              <MapIcon size={14} aria-hidden /> {t('map.mapView')}
            </span>
          </Tab>
          <Tab value="list">
            <span className="inline-flex items-center gap-1.5">
              <List size={14} aria-hidden /> {t('map.listView')}
            </span>
          </Tab>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={MapPinned}
            title={t('map.noResults')}
            description={t('map.coordinatesHint')}
          />
        </Card>
      ) : tab === 'map' ? (
        <Card className="mt-4" padded={false}>
          {mapped.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={MapPinOff}
                title={t('map.noCoordinatesTitle')}
                description={t('map.missingText')}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink-800">
                  <MapPinned size={16} className="text-forest-700" aria-hidden />
                  {t('map.holdingsCount', { count: mapped.length })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {demoCoordinates ? <Badge tone="clay">{t('map.fictionalNote')}</Badge> : null}
                  <Badge tone="slate">OpenStreetMap</Badge>
                </div>
              </div>
              <MapErrorBoundary title={t('map.fallbackTitle')} text={t('map.fallbackText')}>
                <div className="h-[420px] w-full overflow-hidden rounded-b-2xl sm:h-[520px]">
                  <MapContainer
                    center={[center.lat, center.lng]}
                    zoom={center.zoom}
                    scrollWheelZoom
                    className="h-full w-full"
                    attributionControl
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution={t('map.osmAttribution')}
                    />
                    <FitBounds points={points} />
                    {mapped.map((holding) => {
                      const crops = holdingCrops(holding);
                      const owner = farmerNames.get(holding.ownerFarmerId) ?? holding.ownerFarmerId;
                      return (
                        <CircleMarker
                          key={holding.id}
                          center={[holding.latitude as number, holding.longitude as number]}
                          radius={9}
                          pathOptions={{
                            color: holding.status === 'ACTIVE' ? '#1f5a40' : '#a1662a',
                            fillColor: holding.coordinatesAreDemo ? '#c98a2e' : '#2d7a58',
                            fillOpacity: 0.8,
                            weight: 2,
                          }}
                        >
                          <Popup>
                            <div className="min-w-48 space-y-1.5">
                              <p className="text-sm font-bold text-ink-900">{holding.name}</p>
                              <p className="text-xs text-ink-600">
                                <span className="font-semibold">{t('map.popup.owner')}:</span> {owner}
                              </p>
                              <p className="text-xs text-ink-600">
                                <span className="font-semibold">{t('map.popup.commune')}:</span> {holding.commune}
                              </p>
                              <p className="text-xs text-ink-600">
                                <span className="font-semibold">{t('map.popup.area')}:</span>{' '}
                                {formatArea(holding.totalCultivatedAreaHa, language)}
                              </p>
                              <p className="text-xs text-ink-600">
                                <span className="font-semibold">{t('map.popup.crops')}:</span>{' '}
                                {crops.length ? crops.slice(0, 4).join(', ') : t('common.none')}
                              </p>
                              {holding.coordinatesAreDemo ? (
                                <Badge tone="clay">{t('map.demoCoordinates')}</Badge>
                              ) : null}
                              <Link
                                to={`/holdings/${holding.id}`}
                                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-forest-800 hover:underline"
                              >
                                {t('map.popup.open')} <ExternalLink size={11} aria-hidden />
                              </Link>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                </div>
              </MapErrorBoundary>
              <p className="border-t border-ink-100 px-4 py-2 text-[11px] leading-relaxed text-ink-500">
                {t('map.tileNotice')} {t('map.osmAttribution')}
              </p>
            </>
          )}
        </Card>
      ) : (
        <Card className="mt-4" padded={false}>
          <div className="p-4 sm:p-5">
            <TableWrap>
              <TableHead>
                <TableRow>
                  <TableTh>{t('reports.column.holding')}</TableTh>
                  <TableTh>{t('reports.column.farmer')}</TableTh>
                  <TableTh>{t('reports.column.commune')}</TableTh>
                  <TableTh>{t('reports.column.cultivatedArea')}</TableTh>
                  <TableTh>{t('reports.column.coordinates')}</TableTh>
                  <TableTh>{t('common.actions')}</TableTh>
                </TableRow>
              </TableHead>
              <TableBody>
                {mapped.map((holding) => (
                  <TableRow key={holding.id}>
                    <TableTd className="font-semibold text-ink-800">{holding.name}</TableTd>
                    <TableTd className="text-xs">
                      {farmerNames.get(holding.ownerFarmerId) ?? holding.ownerFarmerId}
                    </TableTd>
                    <TableTd className="text-xs">{holding.commune}</TableTd>
                    <TableTd className="text-xs">{formatArea(holding.totalCultivatedAreaHa, language)}</TableTd>
                    <TableTd className="whitespace-nowrap font-mono text-xs">
                      {holding.latitude?.toFixed(5)}, {holding.longitude?.toFixed(5)}
                    </TableTd>
                    <TableTd>
                      <Link
                        to={`/holdings/${holding.id}`}
                        className="text-xs font-semibold text-forest-800 hover:underline"
                      >
                        {t('common.view')}
                      </Link>
                    </TableTd>
                  </TableRow>
                ))}
              </TableBody>
            </TableWrap>
          </div>
        </Card>
      )}

      <Card className="mt-5">
        <CardHeader
          icon={MapPinOff}
          title={t('map.missingTitle')}
          subtitle={t('map.missingText')}
          action={<Badge tone="amber">{formatNumber(missing.length, language, 0)}</Badge>}
        />
        {missing.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
            {t('map.listView')} · {t('common.none')}
          </p>
        ) : (
          <TableWrap>
            <TableHead>
              <TableRow>
                <TableTh>{t('reports.column.holding')}</TableTh>
                <TableTh>{t('reports.column.farmer')}</TableTh>
                <TableTh>{t('reports.column.commune')}</TableTh>
                <TableTh>{t('reports.column.cultivatedArea')}</TableTh>
                <TableTh>{t('common.actions')}</TableTh>
              </TableRow>
            </TableHead>
            <TableBody>
              {missing.map((holding) => (
                <TableRow key={holding.id}>
                  <TableTd className="font-semibold text-ink-800">{holding.name}</TableTd>
                  <TableTd className="text-xs">
                    {farmerNames.get(holding.ownerFarmerId) ?? holding.ownerFarmerId}
                  </TableTd>
                  <TableTd className="text-xs">{holding.commune}</TableTd>
                  <TableTd className="text-xs">{formatArea(holding.totalCultivatedAreaHa, language)}</TableTd>
                  <TableTd>
                    <Link
                      to={`/holdings/${holding.id}`}
                      className="text-xs font-semibold text-forest-800 hover:underline"
                    >
                      {t('common.edit')}
                    </Link>
                  </TableTd>
                </TableRow>
              ))}
            </TableBody>
          </TableWrap>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <KeyValue label={t('common.dataNotice')}>
            <span className="inline-flex items-center gap-1.5">
              <Sprout size={13} className="text-forest-700" aria-hidden /> {t('app.demoData')}
            </span>
          </KeyValue>
          <KeyValue label={t('map.tileNotice')}>
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlert size={13} className="text-clay-600" aria-hidden /> {t('map.fallbackText')}
            </span>
          </KeyValue>
        </div>
      </Card>
    </div>
  );
}
