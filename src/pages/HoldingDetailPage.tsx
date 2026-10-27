import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  Leaf,
  MapPin,
  Plus,
  Sprout,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { statusTone } from '../app/status';
import { useAction } from '../app/useAction';
import { formatArea, formatDate, formatDateTime } from '../domain/format';
import type { CropRecord, Plot } from '../domain/types';
import { useI18n } from '../i18n';
import { repository } from '../repositories';
import { activeSeason } from '../utils/data';
import { ForbiddenPage } from '../components/common/PageStates';
import { HoldingFormModal } from '../components/holdings/HoldingFormModal';
import { PlotFormModal } from '../components/holdings/PlotFormModal';
import { CropFormModal } from '../components/holdings/CropFormModal';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
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

export function HoldingDetailPage() {
  const { id } = useParams();
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { can, refresh } = useWorkspace();
  const { busy, error, run } = useAction();
  const [holdingOpen, setHoldingOpen] = useState(false);
  const [plotOpen, setPlotOpen] = useState(false);
  const [editPlot, setEditPlot] = useState<Plot | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [editCrop, setEditCrop] = useState<CropRecord | null>(null);
  const [deleteCrop, setDeleteCrop] = useState<CropRecord | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const holding = data.holdings.find((item) => item.id === id);
  const season = activeSeason(data);
  const plots = useMemo(
    () => data.plots.filter((plot) => plot.holdingId === id).sort((a, b) => a.name.localeCompare(b.name)),
    [data.plots, id],
  );
  const crops = useMemo(() => data.crops.filter((crop) => crop.holdingId === id), [data.crops, id]);
  const owner = data.farmers.find((farmer) => farmer.id === holding?.ownerFarmerId);
  const canWrite = can('holding:write');

  if (!holding) return <ForbiddenPage />;

  const plotArea = plots.reduce((sum, plot) => sum + plot.areaHa, 0);
  const plotIds = new Set(plots.map((plot) => plot.id));
  const unassignedCrops = crops.filter((crop) => !plotIds.has(crop.plotId));

  const removeCrop = async () => {
    if (!deleteCrop) return;
    await run('delete-crop', () => repository.deleteCrop(deleteCrop.id), {
      success: t('holdings.cropDeleted'),
      onSuccess: async () => {
        setDeleteCrop(null);
        await refresh();
      },
    });
  };

  const mergeWarnings = async (next: string[]) => {
    setWarnings(next);
    await refresh();
  };

  return (
    <div>
      <PageHeader
        eyebrow={t('holdings.detail')}
        title={holding.name}
        subtitle={`${owner?.fullName ?? t('common.unknown')} · ${holding.commune}`}
        actions={
          <>
            <Link to="/holdings">
              <Button variant="outline" icon={ArrowLeft} className="rtl:[&_svg]:rotate-180">
                {t('common.back')}
              </Button>
            </Link>
            {canWrite ? (
              <Button variant="secondary" icon={Edit3} onClick={() => setHoldingOpen(true)}>
                {t('holdings.edit')}
              </Button>
            ) : null}
          </>
        }
      />

      {error ? <AlertBanner tone="danger" className="mb-4">{error}</AlertBanner> : null}
      {warnings.length > 0 ? (
        <AlertBanner tone="warning" className="mb-4" title={t('holdings.warningTitle')}>
          <ul className="list-inside list-disc space-y-1">
            {warnings.map((warning) => (
              <li key={warning}>{t(`warning.${warning}`)}</li>
            ))}
          </ul>
        </AlertBanner>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            icon={Sprout}
            title={t('holdings.summary')}
            subtitle={holding.id}
            action={<Badge tone={statusTone(holding.status)}>{t(`status.${holding.status}`)}</Badge>}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KeyValue label={t('field.owner')}>
              {owner ? (
                <Link to={`/farmers/${owner.id}`} className="font-semibold text-forest-800 hover:underline">
                  {owner.fullName}
                </Link>
              ) : (
                '—'
              )}
            </KeyValue>
            <KeyValue label={t('field.commune')}>{holding.commune}</KeyValue>
            <KeyValue label={t('field.wilaya')}>{holding.wilaya}</KeyValue>
            <KeyValue label={t('field.totalArea')}>{formatArea(holding.totalCultivatedAreaHa, language)}</KeyValue>
            <KeyValue label={t('holdings.plots')}>{plots.length}</KeyValue>
            <KeyValue label={t('holdings.crops')}>{crops.length}</KeyValue>
            <KeyValue label={t('field.address')}>{holding.address ?? '—'}</KeyValue>
            <KeyValue label={t('field.coordinates')}>
              {holding.latitude !== undefined ? (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-ink-400" aria-hidden />
                  {holding.latitude.toFixed(5)}, {holding.longitude?.toFixed(5)}
                  {holding.coordinatesAreDemo ? (
                    <Badge tone="clay">{t('holdings.demoCoordinates')}</Badge>
                  ) : null}
                </span>
              ) : (
                t('holdings.noCoordinates')
              )}
            </KeyValue>
            <KeyValue label={t('common.createdAt')}>{formatDate(holding.createdAt, language)}</KeyValue>
            <KeyValue label={t('common.updatedAt')}>{formatDateTime(holding.updatedAt, language)}</KeyValue>
          </div>
        </Card>

        <Card>
          <CardHeader icon={TriangleAlert} title={t('holdings.areaSummary')} subtitle={t('holdings.areaCheckNote')} />
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-600">{t('holdings.holdingArea')}</span>
              <span className="font-semibold text-ink-900">{formatArea(holding.totalCultivatedAreaHa, language)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-600">{t('holdings.cropsArea')}</span>
              <span className="font-semibold text-ink-900">{formatArea(plotArea, language)}</span>
            </div>
            {plotArea > holding.totalCultivatedAreaHa + 0.0001 ? (
              <AlertBanner tone="warning" title={t('holdings.areaExceeded')}>
                {t('holdings.areaCheckNote')}
              </AlertBanner>
            ) : (
              <AlertBanner tone="success" title={t('status.OK')}>
                {t('holdings.areaCheckNote')}
              </AlertBanner>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          icon={MapPin}
          title={t('holdings.plots')}
          subtitle={t('holdings.plotListEmpty')}
          action={
            canWrite ? (
              <Button
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditPlot(null);
                  setPlotOpen(true);
                }}
              >
                {t('holdings.addPlot')}
              </Button>
            ) : undefined
          }
        />
        {plots.length === 0 ? (
          <EmptyState compact icon={MapPin} title={t('holdings.plots')} description={t('holdings.plotListEmpty')} />
        ) : (
          <div className="space-y-4">
            {plots.map((plot) => {
              const plotCrops = crops.filter((crop) => crop.plotId === plot.id);
              const cropArea = plotCrops.reduce((sum, crop) => sum + crop.areaHa, 0);
              return (
                <div key={plot.id} className="rounded-xl border border-ink-100">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 bg-sand-50/50 px-4 py-3">
                    <div>
                      <p className="font-display text-base font-semibold text-ink-900">{plot.name}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {formatArea(plot.areaHa, language)}
                        {plot.soilType ? ` · ${plot.soilType}` : ''}
                        {cropArea > plot.areaHa + 0.0001 ? (
                          <Badge tone="amber" className="ms-2">
                            {t('warning.CROP_AREA_EXCEEDS_PLOT')}
                          </Badge>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {canWrite ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            icon={Edit3}
                            onClick={() => {
                              setEditPlot(plot);
                              setPlotOpen(true);
                            }}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            size="sm"
                            icon={Plus}
                            onClick={() => {
                              setEditCrop(null);
                              setCropOpen(true);
                            }}
                          >
                            {t('holdings.addCrop')}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {plotCrops.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-ink-500">{t('holdings.cropListEmpty')}</p>
                  ) : (
                    <TableWrap className="rounded-none border-0">
                      <TableHead>
                        <TableRow>
                          <TableTh>{t('holdings.cropName')}</TableTh>
                          <TableTh>{t('common.category')}</TableTh>
                          <TableTh>{t('field.season')}</TableTh>
                          <TableTh>{t('common.area')}</TableTh>
                          <TableTh>{t('holdings.plantingDate')}</TableTh>
                          <TableTh>{t('common.actions')}</TableTh>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {plotCrops.map((crop) => {
                          const cropSeason = data.seasons.find((item) => item.id === crop.seasonId);
                          return (
                            <TableRow key={crop.id}>
                              <TableTd className="font-semibold text-ink-900">{crop.name}</TableTd>
                              <TableTd>{crop.category}</TableTd>
                              <TableTd>{cropSeason?.label ?? '—'}</TableTd>
                              <TableTd>{formatArea(crop.areaHa, language)}</TableTd>
                              <TableTd>{crop.plantingDate ? formatDate(crop.plantingDate, language) : '—'}</TableTd>
                              <TableTd>
                                <div className="flex flex-wrap gap-1.5">
                                  {canWrite ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        icon={Edit3}
                                        onClick={() => {
                                          setEditCrop(crop);
                                          setCropOpen(true);
                                        }}
                                      >
                                        {t('common.edit')}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        icon={Trash2}
                                        onClick={() => setDeleteCrop(crop)}
                                      >
                                        {t('common.delete')}
                                      </Button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-ink-400">—</span>
                                  )}
                                </div>
                              </TableTd>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </TableWrap>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {unassignedCrops.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">{t('holdings.warningTitle')}</p>
            <p className="mt-1">{t('warning.CROP_AREA_EXCEEDS_PLOT')}</p>
            <ul className="mt-1 list-inside list-disc">
              {unassignedCrops.map((crop) => (
                <li key={crop.id}>
                  {crop.name} · {formatArea(crop.areaHa, language)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {season ? (
          <span className="text-xs text-ink-500">
            {t('dashboard.activeSeason')}: <strong>{season.label}</strong>
          </span>
        ) : null}
        <Link to={`/map?holding=${holding.id}`} className="text-xs font-semibold text-forest-700 hover:underline">
          {t('dashboard.openMap')} →
        </Link>
        <Link to={`/treatments?holdingId=${holding.id}`} className="text-xs font-semibold text-forest-700 hover:underline">
          {t('nav.treatments')} →
        </Link>
      </div>

      <HoldingFormModal
        open={holdingOpen}
        holding={holding}
        farmers={data.farmers}
        communes={data.settings.communes}
        canChooseOwner={data.role !== 'FARMER'}
        onClose={() => setHoldingOpen(false)}
        onSaved={async (_updated, next) => {
          await mergeWarnings(next);
        }}
      />

      <PlotFormModal
        open={plotOpen}
        holdingId={holding.id}
        plot={editPlot}
        onClose={() => setPlotOpen(false)}
        onSaved={async (_plot, next) => {
          await mergeWarnings(next);
        }}
      />

      <CropFormModal
        open={cropOpen}
        crop={editCrop}
        plots={plots}
        seasons={data.seasons}
        categories={data.settings.cropCategories}
        suggestions={data.settings.cropSuggestions}
        defaultSeasonId={season?.id}
        onClose={() => setCropOpen(false)}
        onSaved={async (_crop, next) => {
          await mergeWarnings(next);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteCrop)}
        onClose={() => setDeleteCrop(null)}
        onConfirm={() => void removeCrop()}
        title={t('holdings.deleteCropTitle')}
        description={t('holdings.deleteCropText')}
        confirmLabel={t('common.delete')}
        tone="danger"
        loading={busy === 'delete-crop'}
      >
        {deleteCrop ? (
          <p className="text-sm text-ink-600">
            {deleteCrop.name} · {formatArea(deleteCrop.areaHa, language)}
          </p>
        ) : null}
      </ConfirmDialog>

      {busy === 'delete-crop' ? null : error?.includes('treatments') ? (
        <AlertBanner tone="danger" className="mt-4">
          {t('holdings.deleteCropBlocked')}
        </AlertBanner>
      ) : null}
    </div>
  );
}
