import { useEffect, type ReactNode } from 'react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import type { Permission } from './domain/types';
import { translateServerError, useI18n } from './i18n';
import { useWorkspace } from './app/WorkspaceProvider';
import { AppShell } from './components/layout/AppShell';
import {
  AlertBanner,
  Button,
  Card,
  LoadingPage,
} from './components/ui/primitives';
import { ForbiddenPage, NotFoundPage } from './components/common/PageStates';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { RegistrationsPage } from './pages/RegistrationsPage';
import { FarmersPage } from './pages/FarmersPage';
import { FarmerDetailPage } from './pages/FarmerDetailPage';
import { HoldingsPage } from './pages/HoldingsPage';
import { HoldingDetailPage } from './pages/HoldingDetailPage';
import { CataloguePage } from './pages/CataloguePage';
import { InventoryPage } from './pages/InventoryPage';
import { TreatmentsPage } from './pages/TreatmentsPage';
import { TreatmentFormPage } from './pages/TreatmentFormPage';
import { TreatmentDetailPage } from './pages/TreatmentDetailPage';
import { TfiPage } from './pages/TfiPage';
import { AlertsPage } from './pages/AlertsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';
import { MapPage } from './pages/MapPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';

function FullPageSpinner() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white px-6 py-10 shadow-sm">
        <LoadingPage label={t('common.loadingData')} />
      </div>
    </div>
  );
}

function ServiceUnavailable({ code }: { code: string | null }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <Card className="w-full max-w-xl">
        <div className="flex flex-col items-center py-6 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <ShieldAlert size={26} aria-hidden />
          </span>
          <h1 className="font-display text-2xl font-bold text-ink-900">{t('error.serverUnreachable')}</h1>
          <AlertBanner tone="danger" className="mt-4 w-full text-start">
            {translateServerError(t, code ?? undefined, t('error.network'))}
          </AlertBanner>
          <Button
            className="mt-5"
            icon={RefreshCw}
            onClick={() => window.location.reload()}
          >
            {t('common.retry')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * Public routes (login / registration). A workspace that is already
 * authenticated is redirected to the dashboard because demo sessions have no
 * separate "logged-out" landing page.
 */
function PublicRoutes() {
  const { status, errorCode } = useWorkspace();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'error') return <ServiceUnavailable code={errorCode} />;
  if (status === 'ready') return <Navigate to="/" replace />;
  return <Outlet />;
}

function RequireAuth() {
  const { status, errorCode } = useWorkspace();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'error') return <ServiceUnavailable code={errorCode} />;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Client-side route guard. The local server enforces the same permission. */
function Guard({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useWorkspace();
  return can(permission) ? <>{children}</> : <ForbiddenPage />;
}

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);
  return null;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicRoutes />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route
              index
              element={
                <Guard permission="dashboard:view">
                  <DashboardPage />
                </Guard>
              }
            />
            <Route
              path="registrations"
              element={
                <Guard permission="registration:review">
                  <RegistrationsPage />
                </Guard>
              }
            />
            <Route
              path="farmers"
              element={
                <Guard permission="farmer:read">
                  <FarmersPage />
                </Guard>
              }
            />
            <Route
              path="farmers/:id"
              element={
                <Guard permission="farmer:read">
                  <FarmerDetailPage />
                </Guard>
              }
            />
            <Route
              path="holdings"
              element={
                <Guard permission="holding:read">
                  <HoldingsPage />
                </Guard>
              }
            />
            <Route
              path="holdings/:id"
              element={
                <Guard permission="holding:read">
                  <HoldingDetailPage />
                </Guard>
              }
            />
            <Route
              path="catalogue"
              element={
                <Guard permission="catalogue:read">
                  <CataloguePage />
                </Guard>
              }
            />
            <Route
              path="inventory"
              element={
                <Guard permission="inventory:read">
                  <InventoryPage />
                </Guard>
              }
            />
            <Route
              path="treatments"
              element={
                <Guard permission="treatment:read">
                  <TreatmentsPage />
                </Guard>
              }
            />
            <Route
              path="treatments/new"
              element={
                <Guard permission="treatment:write">
                  <TreatmentFormPage />
                </Guard>
              }
            />
            <Route
              path="treatments/:id"
              element={
                <Guard permission="treatment:read">
                  <TreatmentDetailPage />
                </Guard>
              }
            />
            <Route
              path="treatments/:id/edit"
              element={
                <Guard permission="treatment:write">
                  <TreatmentFormPage />
                </Guard>
              }
            />
            <Route
              path="tfi"
              element={
                <Guard permission="tfi:read">
                  <TfiPage />
                </Guard>
              }
            />
            <Route
              path="alerts"
              element={
                <Guard permission="alert:read">
                  <AlertsPage />
                </Guard>
              }
            />
            <Route
              path="reports"
              element={
                <Guard permission="report:export">
                  <ReportsPage />
                </Guard>
              }
            />
            <Route
              path="audit"
              element={
                <Guard permission="audit:view">
                  <AuditPage />
                </Guard>
              }
            />
            <Route
              path="map"
              element={
                <Guard permission="map:view">
                  <MapPage />
                </Guard>
              }
            />
            <Route
              path="settings"
              element={
                <Guard permission="settings:manage">
                  <SettingsPage />
                </Guard>
              }
            />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
