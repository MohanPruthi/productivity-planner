import { API_URL, REQUEST_TIMEOUT_MS } from './config';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiToken(token: string | null) {
  authToken = token;
}

// Called when the server rejects the token (403), so the app can sign out
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  auth?: boolean;
};

export async function api<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, timeoutMs = REQUEST_TIMEOUT_MS, auth = true } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiError('The server took too long to respond. Please try again.', 0);
    }
    throw new ApiError('Could not reach the server. Check your connection.', 0);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 403 && auth && authToken) {
      onUnauthorized?.();
    }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong';
}
