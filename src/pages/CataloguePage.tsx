import { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Edit3,
  FlaskConical,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useWorkspace, useWorkspaceData } from '../app/WorkspaceProvider';
import { statusTone, verificationTone } from '../app/status';
import { useAction } from '../app/useAction';
import { formatNumber } from '../domain/format';
import type { PesticideProduct } from '../domain/types';
import { useI18n } from '../i18n';
import { repository } from '../repositories';
import { ProductFormModal } from '../components/catalogue/ProductFormModal';
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  ConfirmDialog,
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

const PRODUCT_CATEGORY_FALLBACKS = [
  'Insecticide',
  'Fungicide',
  'Herbicide',
  'Acaricide',
  'Rodenticide',
  'Other',
];

export function CataloguePage() {
  const { t, language } = useI18n();
  const data = useWorkspaceData();
  const { can, refresh } = useWorkspace();
  const { busy, run } = useAction();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [verification, setVerification] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<PesticideProduct | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<PesticideProduct | null>(null);

  const categories = useMemo(
    () =>
      [...new Set([...PRODUCT_CATEGORY_FALLBACKS, ...data.pesticides.map((item) => item.category)])].sort(),
    [data.pesticides],
  );

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.pesticides
      .filter((product) => showArchived || !product.archived)
      .filter((product) => category === 'all' || product.category === category)
      .filter((product) => verification === 'all' || product.verificationStatus === verification)
      .filter((product) => {
        if (!term) return true;
        return [
          product.commercialName,
          product.activeIngredient,
          product.manufacturer,
          product.registrationReference,
          product.formulation,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => a.commercialName.localeCompare(b.commercialName));
  }, [category, data.pesticides, search, showArchived, verification]);

  const openCreate = () => {
    setEditProduct(null);
    setFormOpen(true);
  };

  const openEdit = (product: PesticideProduct) => {
    setEditProduct(product);
    setFormOpen(true);
  };

  const toggleArchive = async () => {
    if (!archiveTarget) return;
    const nextArchived = !archiveTarget.archived;
    await run(
      'archive-product',
      () => repository.setProductArchived(archiveTarget.id, nextArchived),
      {
        success: nextArchived ? t('catalogue.archivedSuccess') : t('catalogue.unarchivedSuccess'),
        onSuccess: async () => {
          setArchiveTarget(null);
          await refresh();
        },
      },
    );
  };

  return (
    <div>
      <PageHeader
        title={t('catalogue.title')}
        subtitle={t('catalogue.subtitle')}
        eyebrow={t('nav.section.operations')}
        actions={
          can('catalogue:manage') ? (
            <Button icon={Plus} onClick={openCreate}>
              {t('catalogue.add')}
            </Button>
          ) : undefined
        }
      />

      <AlertBanner tone="warning" className="mb-5" title={t('catalogue.demoNotice')}>
        {t('catalogue.referenceSectionNote')}
      </AlertBanner>

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label={t('common.search')} htmlFor="catalogue-search">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <input
                id="catalogue-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('catalogue.searchPlaceholder')}
                className="w-full rounded-lg border border-ink-200 bg-white py-2 pe-3 ps-9 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
              />
            </div>
          </Field>
          <Field label={t('common.category')} htmlFor="catalogue-category">
            <Select
              id="catalogue-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">{t('catalogue.allCategories')}</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('field.verificationStatus')} htmlFor="catalogue-verification">
            <Select
              id="catalogue-verification"
              value={verification}
              onChange={(event) => setVerification(event.target.value)}
            >
              <option value="all">{t('catalogue.allVerification')}</option>
              <option value="VERIFIED">{t('verification.VERIFIED')}</option>
              <option value="DEMO">{t('verification.DEMO')}</option>
              <option value="UNVERIFIED">{t('verification.UNVERIFIED')}</option>
            </Select>
          </Field>
          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                className="h-4 w-4 rounded border-ink-300 text-forest-700 focus:ring-forest-500"
              />
              {t('catalogue.viewArchived')}
            </label>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          {t('catalogue.productCount', { count: formatNumber(products.length, language, 0) })}
        </p>
      </Card>

      {products.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title={t('catalogue.emptyTitle')}
          description={t('catalogue.emptyText')}
          action={
            can('catalogue:manage') ? (
              <Button icon={Plus} onClick={openCreate}>
                {t('catalogue.add')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TableWrap>
          <TableHead>
            <TableRow>
              <TableTh>{t('catalogue.table.product')}</TableTh>
              <TableTh>{t('catalogue.table.ingredient')}</TableTh>
              <TableTh>{t('catalogue.table.category')}</TableTh>
              <TableTh>{t('catalogue.table.formulation')}</TableTh>
              <TableTh>{t('catalogue.table.referenceDose')}</TableTh>
              <TableTh>{t('catalogue.table.stock')}</TableTh>
              <TableTh>{t('catalogue.table.verification')}</TableTh>
              <TableTh>{t('catalogue.table.status')}</TableTh>
              {can('catalogue:manage') ? <TableTh>{t('catalogue.table.actions')}</TableTh> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableTd>
                  <span className="block font-semibold text-ink-900">{product.commercialName}</span>
                  <span className="block text-xs text-ink-500">{product.manufacturer}</span>
                  {product.registrationReference ? (
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-400">
                      <ShieldCheck size={11} aria-hidden />
                      {product.registrationReference}
                    </span>
                  ) : null}
                </TableTd>
                <TableTd>{product.activeIngredient}</TableTd>
                <TableTd>{product.category}</TableTd>
                <TableTd>{product.formulation}</TableTd>
                <TableTd>
                  {product.referenceDose !== undefined && product.referenceDoseUnit ? (
                    <span className="font-mono text-xs">
                      {formatNumber(product.referenceDose, language, 4)} {product.referenceDoseUnit}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-400">{t('catalogue.noReference')}</span>
                  )}
                </TableTd>
                <TableTd>
                  {product.stockUnit}
                  <span className="block text-[11px] text-ink-400">
                    {t('field.threshold')}: {formatNumber(product.lowStockThreshold, language)}
                  </span>
                </TableTd>
                <TableTd>
                  <Badge tone={verificationTone(product.verificationStatus)}>
                    {t(`verification.${product.verificationStatus}`)}
                  </Badge>
                </TableTd>
                <TableTd>
                  {product.archived ? (
                    <Badge tone="slate">{t('catalogue.archivedBadge')}</Badge>
                  ) : (
                    <Badge tone={statusTone('ACTIVE')}>{t('status.ACTIVE')}</Badge>
                  )}
                </TableTd>
                {can('catalogue:manage') ? (
                  <TableTd>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" icon={Edit3} onClick={() => openEdit(product)}>
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={product.archived ? ArchiveRestore : Archive}
                        onClick={() => setArchiveTarget(product)}
                      >
                        {product.archived ? t('action.unarchive') : t('action.archive')}
                      </Button>
                    </div>
                  </TableTd>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </TableWrap>
      )}

      <ProductFormModal
        open={formOpen}
        product={editProduct}
        categories={categories}
        communes={data.settings.communes}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          await refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => void toggleArchive()}
        title={
          archiveTarget?.archived
            ? t('catalogue.unarchiveTitle')
            : t('catalogue.archiveTitle')
        }
        description={
          archiveTarget?.archived
            ? t('catalogue.unarchiveText')
            : t('catalogue.archiveText')
        }
        confirmLabel={archiveTarget?.archived ? t('action.unarchive') : t('action.archive')}
        tone={archiveTarget?.archived ? 'primary' : 'danger'}
        loading={busy === 'archive-product'}
      >
        {archiveTarget ? (
          <div className="space-y-1 text-sm text-ink-600">
            <p className="font-semibold text-ink-800">{archiveTarget.commercialName}</p>
            <p>{archiveTarget.activeIngredient}</p>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
