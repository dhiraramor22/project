import type { Role } from '../domain/types';

export interface Session {
  userId: string;
  role: Role;
}

export const SESSION_STORAGE_KEY = 'eloued.session';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.userId !== 'string' || typeof parsed.role !== 'string') return null;
    if (!['DSA_ADMIN', 'CHAMBER_ADMIN', 'FARMER'].includes(parsed.role)) return null;
    return { userId: parsed.userId, role: parsed.role as Role };
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Session persistence is best-effort; the in-memory state still works.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function buildQuery(query?: Record<string, string | number | undefined | null>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

async function parseError(response: Response): Promise<ApiRequestError> {
  let code = 'UNKNOWN';
  let message = response.statusText || 'Request failed.';
  let details: unknown;
  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    if (payload.error) {
      code = payload.error.code ?? code;
      message = payload.error.message ?? message;
      details = payload.error.details;
    }
  } catch {
    // Keep the status-based fallback.
  }
  return new ApiRequestError(response.status, code, message, details);
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: {
    body?: unknown;
    query?: Record<string, string | number | undefined | null>;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const session = readSession();
  if (session) {
    headers['x-user-id'] = session.userId;
    headers['x-user-role'] = session.role;
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}${buildQuery(options.query)}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      'The local JSON service could not be reached.',
    );
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function download(
  path: string,
): Promise<{ blob: Blob; fileName: string }> {
  const headers: Record<string, string> = {};
  const session = readSession();
  if (session) {
    headers['x-user-id'] = session.userId;
    headers['x-user-role'] = session.role;
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { headers });
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'The local JSON service could not be reached.');
  }
  if (!response.ok) throw await parseError(response);
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return {
    blob: await response.blob(),
    fileName: match?.[1] ?? 'el-oued-backup.json',
  };
}

export const apiClient = {
  get: <T>(path: string, query?: Record<string, string | number | undefined | null>) =>
    request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  download,
};

/** Saves a blob to the user's downloads folder without any server round-trip. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
