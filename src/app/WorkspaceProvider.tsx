import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { BootstrapPayload, DemoIdentity, PublicConfig } from '../domain/api';
import { permissionsForRole } from '../domain/permissions';
import type { FarmerProfile, Permission } from '../domain/types';
import { repository } from '../repositories';
import {
  ApiRequestError,
  clearSession,
  readSession,
  writeSession,
  type Session,
} from '../services/apiClient';

type WorkspaceStatus = 'loading' | 'ready' | 'unauthenticated' | 'error';

interface WorkspaceContextValue {
  status: WorkspaceStatus;
  publicConfig: PublicConfig | null;
  data: BootstrapPayload | null;
  session: Session | null;
  permissions: Permission[];
  farmer: FarmerProfile | null;
  demoUsers: DemoIdentity[];
  errorCode: string | null;
  login: (userId: string) => Promise<BootstrapPayload>;
  logout: () => void;
  refresh: () => Promise<void>;
  reloadPublicConfig: () => Promise<void>;
  can: (permission: Permission) => boolean;
  unreadAlerts: number;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WorkspaceStatus>('loading');
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setStatus('loading');
    setErrorCode(null);
    try {
      const config = await repository.getPublicConfig();
      setPublicConfig(config);
    } catch (error) {
      if (error instanceof ApiRequestError) setErrorCode(error.code);
      setStatus('error');
      return;
    }

    const stored = readSession();
    setSession(stored);
    if (!stored) {
      setStatus('unauthenticated');
      return;
    }

    try {
      const payload = await repository.getBootstrap();
      setData(payload);
      setStatus('ready');
    } catch (error) {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        clearSession();
        setSession(null);
        setData(null);
        setStatus('unauthenticated');
        return;
      }
      if (error instanceof ApiRequestError) setErrorCode(error.code);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const login = useCallback(async (userId: string) => {
    const result = await repository.startDemoSession(userId);
    const nextSession: Session = { userId: result.user.id, role: result.role };
    writeSession(nextSession);
    setSession(nextSession);
    const payload = await repository.getBootstrap();
    setData(payload);
    setStatus('ready');
    setErrorCode(null);
    return payload;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    setData(null);
    setStatus('unauthenticated');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const payload = await repository.getBootstrap();
      setData(payload);
      setStatus('ready');
    } catch (error) {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        clearSession();
        setSession(null);
        setData(null);
        setStatus('unauthenticated');
        return;
      }
      throw error;
    }
  }, []);

  const reloadPublicConfig = useCallback(async () => {
    const config = await repository.getPublicConfig();
    setPublicConfig(config);
  }, []);

  const permissions = useMemo<Permission[]>(() => {
    if (!data) return [];
    return permissionsForRole(data.role);
  }, [data]);

  const farmer = useMemo<FarmerProfile | null>(() => {
    if (!data?.farmerId) return null;
    return data.farmers.find((item) => item.id === data.farmerId) ?? null;
  }, [data]);

  const demoUsers = useMemo<DemoIdentity[]>(() => {
    if (data?.demoUsers?.length) return data.demoUsers;
    return publicConfig?.demoUsers ?? [];
  }, [data, publicConfig]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      status,
      publicConfig,
      data,
      session,
      permissions,
      farmer,
      demoUsers,
      errorCode,
      login,
      logout,
      refresh,
      reloadPublicConfig,
      can: (permission) => permissions.includes(permission),
      unreadAlerts: data?.alerts.filter((alert) => !alert.read && !alert.resolved).length ?? 0,
    }),
    [
      status,
      publicConfig,
      data,
      session,
      permissions,
      farmer,
      demoUsers,
      errorCode,
      login,
      logout,
      refresh,
      reloadPublicConfig,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider.');
  return context;
}

/** Convenience hook for pages that only render inside the authenticated shell. */
export function useWorkspaceData(): BootstrapPayload {
  const { data } = useWorkspace();
  if (!data) throw new Error('Workspace data is not loaded yet.');
  return data;
}
