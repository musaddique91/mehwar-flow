import type { AuthResponse } from '@mehwar/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : (body.message ?? res.statusText);
    throw new ApiError(res.status, message, body.errors);
  }
  return body as T;
}

/** Exchanges the httpOnly refresh cookie for a new access token (deduplicated). */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as AuthResponse;
      accessToken = data.accessToken;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const doFetch = () =>
    fetch(`/api${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });

  let res = await doFetch();
  if (res.status === 401 && accessToken && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await doFetch();
  }
  return parse<T>(res);
}
