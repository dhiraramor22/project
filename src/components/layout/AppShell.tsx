import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileBarChart2,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  ScrollText,
  Settings,
  ShieldAlert,
  Sprout,
  SprayCan,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Permission, Role } from '../../domain/types';
import { ROLE_DEFINITIONS } from '../../domain/permissions';
import { useI18n } from '../../i18n';
import { repository } from '../../repositories';
import { formatDateTime } from '../../domain/format';
import { useWorkspace } from '../../app/WorkspaceProvider';
import { alertDescription, alertTitle, roleTone, severityTone } from '../../app/status';
import { useToast } from '../ui/ToastProvider';
import { Badge, Button, Modal, cx } from '../ui/primitives';
import { Logo } from './Logo';
import { LanguageSwitcher } from './LanguageSwitcher';

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  permission?: Permission;
  end?: boolean;
  badge?: number;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

function useNavGroups(): NavGroup[] {
  const { can, unreadAlerts } = useWorkspace();
  const groups: NavGroup[] = [
    {
      labelKey: 'nav.section.main',
      items: [{ to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true }],
    },
    {
      labelKey: 'nav.section.operations',
      items: [
        { to: '/holdings', labelKey: 'nav.holdings', icon: Sprout, permission: 'holding:read' },
        { to: '/catalogue', labelKey: 'nav.catalogue', icon: FlaskConical, permission: 'catalogue:read' },
        { to: '/inventory', labelKey: 'nav.inventory', icon: Boxes, permission: 'inventory:read' },
        { to: '/treatments', labelKey: 'nav.treatments', icon: SprayCan, permission: 'treatment:read' },
        { to: '/tfi', labelKey: 'nav.tfi', icon: Gauge, permission: 'tfi:read' },
      ],
    },
    {
      labelKey: 'nav.section.oversight',
      items: [
        {
          to: '/registrations',
          labelKey: 'nav.registrations',
          icon: ClipboardCheck,
          permission: 'registration:review',
        },
        { to: '/farmers', labelKey: 'nav.farmers', icon: Users, permission: 'farmer:read' },
        {
          to: '/alerts',
          labelKey: 'nav.alerts',
          icon: ShieldAlert,
          permission: 'alert:read',
          badge: unreadAlerts,
        },
        { to: '/reports', labelKey: 'nav.reports', icon: FileBarChart2, permission: 'report:export' },
        { to: '/map', labelKey: 'nav.map', icon: MapIcon, permission: 'map:view' },
        { to: '/audit', labelKey: 'nav.audit', icon: ScrollText, permission: 'audit:view' },
      ],
    },
    {
      labelKey: 'nav.section.system',
      items: [
        { to: '/settings', labelKey: 'nav.settings', icon: Settings, permission: 'settings:manage' },
        { to: '/profile', labelKey: 'nav.profile', icon: UserRound },
      ],
    },
  ];
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || can(item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const { data } = useWorkspace();
  const groups = useNavGroups();

  return (
    <div className="flex h-full flex-col bg-forest-950 text-sand-100">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex items-center gap-3">
          <Logo inverted withText />
          <Badge tone="clay" className="border-clay-500/40 bg-clay-500/15 text-clay-200">
            {t('common.demo')}
          </Badge>
        </div>
      </div>

      <div className="mx-5 mb-4 rounded-xl border border-forest-800 bg-forest-900/70 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sand-400">
          {t('app.institution')}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-sand-200">{t('app.tagline')}</p>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label={t('common.menu')}>
        {groups.map((group) => (
          <div key={group.labelKey}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sand-500">
              {t(group.labelKey)}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cx(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                          isActive
                            ? 'bg-forest-800 font-semibold text-white shadow-sm'
                            : 'text-sand-300 hover:bg-forest-900 hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            size={17}
                            strokeWidth={isActive ? 2.2 : 1.7}
                            className={isActive ? 'text-clay-300' : 'text-sand-500 group-hover:text-sand-200'}
                            aria-hidden
                          />
                          <span className="flex-1 truncate">{t(item.labelKey)}</span>
                          {item.badge ? (
                            <span className="rounded-full bg-clay-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {item.badge}
                            </span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-forest-800 px-5 py-4">
        <p className="text-[10px] leading-relaxed text-sand-500">{t('app.prototypeNotice')}</p>
        <p className="mt-2 text-[10px] text-sand-600">
          {t('common.scope')}
          {data?.scopeCommunes?.length ? ` · ${data.scopeCommunes.join(', ')}` : ''}
        </p>
      </div>
    </div>
  );
}

const ROUTE_KEYS: Record<string, string> = {
  farmers: 'nav.farmers',
  registrations: 'nav.registrations',
  holdings: 'nav.holdings',
  catalogue: 'nav.catalogue',
  inventory: 'nav.inventory',
  treatments: 'nav.treatments',
  tfi: 'nav.tfi',
  alerts: 'nav.alerts',
  reports: 'nav.reports',
  audit: 'nav.audit',
  map: 'nav.map',
  settings: 'nav.settings',
  profile: 'nav.profile',
  new: 'treatments.new',
  edit: 'common.edit',
  print: 'common.print',
};

function Breadcrumbs() {
  const { t } = useI18n();
  const location = useLocation();
  const { data } = useWorkspace();

  const items = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const result: Array<{ label: string; to?: string }> = [
      { label: t('nav.dashboard'), to: '/' },
    ];
    let accumulated = '';
    segments.forEach((segment, index) => {
      accumulated += `/${segment}`;
      const isLast = index === segments.length - 1;
      let label = ROUTE_KEYS[segment] ? t(ROUTE_KEYS[segment]) : segment;
      if (index === 1 && segments[0] === 'farmers') {
        const farmer = data?.farmers.find((item) => item.id === segment);
        if (farmer) label = farmer.fullName;
      }
      if (index === 1 && segments[0] === 'holdings') {
        const holding = data?.holdings.find((item) => item.id === segment);
        if (holding) label = holding.name;
      }
      if (index === 1 && segments[0] === 'treatments') {
        const treatment = data?.treatments.find((item) => item.id === segment);
        if (treatment) label = treatment.id;
      }
      result.push({ label, to: isLast ? undefined : accumulated });
    });
    return result;
  }, [location.pathname, data, t]);

  return (
    <nav aria-label="Breadcrumb" className="mb-4 print:hidden">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-500">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight size={12} className="rtl:rotate-180" aria-hidden /> : null}
            {item.to ? (
              <Link to={item.to} className="rounded transition hover:text-forest-800">
                {item.label}
              </Link>
            ) : (
              <span className="font-semibold text-ink-800">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function NotificationsMenu() {
  const { t, language } = useI18n();
  const { data, refresh, unreadAlerts } = useWorkspace();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const alerts = (data?.alerts ?? []).filter((alert) => !alert.resolved).slice(0, 5);

  const markAll = async () => {
    setBusy(true);
    try {
      await repository.markAllAlertsRead();
      await refresh();
      notify(t('alerts.allRead'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative rounded-lg border border-ink-200 bg-white p-2 text-ink-600 transition hover:border-forest-300 hover:text-forest-800"
        aria-label={t('common.notifications')}
        aria-expanded={open}
      >
        <Bell size={17} />
        {unreadAlerts > 0 ? (
          <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay-500 px-1 text-[9px] font-bold text-white">
            {unreadAlerts > 9 ? '9+' : unreadAlerts}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute end-0 z-40 mt-2 w-[min(88vw,360px)] overflow-hidden rounded-xl border border-ink-100 bg-white shadow-pop animate-fade-in">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-bold text-ink-900">{t('notifications.title')}</p>
            <button
              type="button"
              onClick={markAll}
              disabled={busy || unreadAlerts === 0}
              className="text-xs font-semibold text-forest-700 hover:underline disabled:text-ink-400"
            >
              {t('notifications.markAll')}
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-500">{t('notifications.empty')}</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {alerts.map((alert) => (
                  <li key={alert.id}>
                    <Link
                      to="/alerts"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 transition hover:bg-sand-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone={severityTone(alert.severity)}>{t(`severity.${alert.severity}`)}</Badge>
                        {!alert.read ? <span className="h-2 w-2 rounded-full bg-clay-500" /> : null}
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-ink-800">
                        {alertTitle(t, alert)}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">
                        {alertDescription(t, alert)}
                      </p>
                      <p className="mt-1 text-[10px] text-ink-400">
                        {formatDateTime(alert.updatedAt, language)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            to="/alerts"
            onClick={() => setOpen(false)}
            className="block border-t border-ink-100 bg-ink-50/60 px-4 py-2.5 text-center text-xs font-semibold text-forest-800 hover:bg-ink-100"
          >
            {t('notifications.viewAll')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function UserMenu() {
  const { t } = useI18n();
  const { data, logout, demoUsers, login } = useWorkspace();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!data) return null;
  const roleDefinition = ROLE_DEFINITIONS[data.role];

  const switchRole = async (userId: string) => {
    setSwitching(userId);
    try {
      await login(userId);
      setSwitchOpen(false);
      setOpen(false);
      navigate('/');
      notify(t('auth.switchSuccess'));
    } catch {
      notify(t('error.generic'), 'error');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white py-1 pe-2 ps-1 text-start transition hover:border-forest-300"
        aria-expanded={open}
        aria-label={t('common.account')}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-forest-800 text-xs font-bold text-sand-100">
          {data.user.fullName
            .split(' ')
            .map((part) => part[0])
            .slice(0, 2)
            .join('')}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-36 truncate text-xs font-bold text-ink-900">
            {data.user.fullName}
          </span>
          <span className="block max-w-36 truncate text-[10px] text-ink-500">
            {t(roleDefinition.labelKey)}
          </span>
        </span>
        <ChevronDown size={14} className="text-ink-400" aria-hidden />
      </button>
      {open ? (
        <div className="absolute end-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-pop animate-fade-in">
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-bold text-ink-900">{data.user.fullName}</p>
            <p className="text-xs text-ink-500">{data.user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={roleTone(data.role)}>{t(roleDefinition.labelKey)}</Badge>
              <Badge tone="slate">{t('common.demo')}</Badge>
            </div>
          </div>
          <div className="p-1.5">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
            >
              <UserRound size={15} /> {t('common.profile')}
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSwitchOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm text-ink-700 hover:bg-ink-50"
            >
              <Users size={15} /> {t('common.switchRole')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
                navigate('/');
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm text-red-700 hover:bg-red-50"
            >
              <LogOut size={15} /> {t('common.logout')}
            </button>
          </div>
          <p className="border-t border-ink-100 bg-ink-50/60 px-4 py-2 text-[10px] leading-relaxed text-ink-500">
            {t('app.roleSimulation')}
          </p>
        </div>
      ) : null}

      <Modal
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        title={t('common.switchRole')}
        description={t('auth.demoIdentityNote')}
      >
        <div className="space-y-2">
          {demoUsers.map((identity) => (
            <button
              key={identity.id}
              type="button"
              disabled={switching !== null}
              onClick={() => void switchRole(identity.id)}
              className={cx(
                'flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-start transition',
                identity.id === data.user.id
                  ? 'border-forest-300 bg-forest-50'
                  : 'border-ink-100 hover:border-forest-200 hover:bg-sand-50',
              )}
            >
              <span>
                <span className="block text-sm font-semibold text-ink-900">{identity.fullName}</span>
                <span className="block text-xs text-ink-500">{t(ROLE_DEFINITIONS[identity.role as Role].labelKey)}</span>
              </span>
              {switching === identity.id ? (
                <span className="text-xs text-forest-700">{t('common.loading')}</span>
              ) : (
                <ChevronRight size={16} className="text-ink-400 rtl:rotate-180" />
              )}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  const { data } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (!data) return null;

  return (
    <div className="min-h-screen bg-sand-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        {t('common.skipToContent')}
      </a>

      <aside className="fixed inset-y-0 start-0 z-30 hidden w-72 lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/60"
            aria-label={t('common.closeMenu')}
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 w-[min(86vw,320px)] shadow-pop animate-slide-in">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute end-2 top-3 z-10 rounded-lg p-1.5 text-sand-300 hover:bg-forest-900 hover:text-white"
              aria-label={t('common.closeMenu')}
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:ps-72">
        <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/90 backdrop-blur print:hidden">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-ink-200 p-2 text-ink-600 hover:border-forest-300 lg:hidden"
              aria-label={t('common.openMenu')}
            >
              <Menu size={18} />
            </button>
            <div className="hidden min-w-0 flex-1 md:block">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
                {t('app.agriculture')}
              </p>
              <p className="truncate text-sm font-semibold text-ink-800">{data.settings.institution}</p>
            </div>
            <div className="ms-auto flex items-center gap-2">
              <LanguageSwitcher />
              <NotificationsMenu />
              <UserMenu />
            </div>
          </div>
        </header>

        <div className="border-b border-clay-200/70 bg-clay-50/80 px-4 py-2 print:hidden sm:px-6">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-clay-900">
            <span className="font-bold uppercase tracking-wide">
              {((import.meta as any).env?.VITE_PREVIEW_MODE === 'true') || (typeof window !== 'undefined' && (window.location.hostname.includes('.vercel.app') || window.location.hostname.includes('.vercel.com')))
                ? 'DEMO PREVIEW MODE - UI inspection only'
                : t('dashboard.demoBannerTitle')}
            </span>
            <span className="hidden sm:inline">
              {((import.meta as any).env?.VITE_PREVIEW_MODE === 'true') || (typeof window !== 'undefined' && (window.location.hostname.includes('.vercel.app') || window.location.hostname.includes('.vercel.com')))
                ? 'No backend connected. Changes are not persisted. Not secure authentication.'
                : t('app.roleSimulation')}
            </span>
            <span className="ms-auto inline-flex items-center gap-1.5">
              <Badge tone={roleTone(data.role)}>
                {t(ROLE_DEFINITIONS[data.role].labelKey)}
              </Badge>
              <Badge tone="slate">{t('common.demo')}</Badge>
            </span>
          </div>
        </div>

        <main id="main-content" className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6 lg:p-8">
          <Breadcrumbs />
          {children ?? <Outlet />}
          <footer className="mt-12 border-t border-ink-100 py-5 text-[11px] leading-relaxed text-ink-400 print:hidden">
            <p>{t('app.prototypeNotice')} {t('app.localOnly')}</p>
            <p className="mt-1">{t('app.version')} 1.0.0 · {t('app.demoData')}</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
