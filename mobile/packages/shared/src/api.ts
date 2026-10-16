/**
 * API client shared by the three apps.
 *
 * - Sends the access token; when the API answers 401 it exchanges the refresh token for a
 *   new pair exactly once (concurrent requests wait for the same refresh) and retries.
 * - If the refresh fails the session is over: tokens are cleared and the app is told.
 * - Network failures surface as ApiError(0) with a human message, never an unhandled throw.
 */
export interface Tokens {
  access_token: string
  refresh_token: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
  /** True when the request never reached the API (offline, DNS, server down). */
  get isNetwork() {
    return this.status === 0
  }
}

type RefreshListener = (payload: Record<string, any>) => void | Promise<void>

const state: {
  baseUrl: string
  tokens: Tokens | null
  onRefreshed: RefreshListener | null
  onExpired: (() => void) | null
  refreshing: Promise<boolean> | null
} = { baseUrl: '', tokens: null, onRefreshed: null, onExpired: null, refreshing: null }

export function configureApi(options: { baseUrl: string }) {
  state.baseUrl = options.baseUrl.replace(/\/+$/, '')
}

export const getApiBaseUrl = () => state.baseUrl
export const getTokens = () => state.tokens

export function setTokens(tokens: Tokens | null) {
  state.tokens = tokens
}

/** Called by the session provider so it can persist rotated tokens and react to expiry. */
export function bindSession(handlers: { onRefreshed: RefreshListener; onExpired: () => void }) {
  state.onRefreshed = handlers.onRefreshed
  state.onExpired = handlers.onExpired
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) return String(data.detail[0].msg).replace(/^Value error, /, '')
  } catch {
    /* non-JSON body */
  }
  if (res.status === 429) return 'Too many attempts. Please wait a moment and try again.'
  if (res.status >= 500) return 'The server had a problem. Please try again.'
  return `Request failed (${res.status})`
}

async function send(method: string, path: string, body: unknown, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  try {
    return await fetch(state.baseUrl + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the clinic server. Check your internet connection and try again.')
  }
}

async function refreshOnce(): Promise<boolean> {
  if (!state.tokens?.refresh_token) return false
  if (!state.refreshing) {
    state.refreshing = (async () => {
      try {
        const res = await send('POST', '/api/auth/refresh', { refresh_token: state.tokens!.refresh_token }, null)
        if (!res.ok) return false
        const payload = await res.json()
        state.tokens = { access_token: payload.access_token, refresh_token: payload.refresh_token }
        await state.onRefreshed?.(payload)
        return true
      } catch (err) {
        // Offline is not "session expired": keep the tokens and let the caller see the network error.
        if (err instanceof ApiError && err.isNetwork) throw err
        return false
      } finally {
        state.refreshing = null
      }
    })()
  }
  return state.refreshing
}

async function request<T>(method: string, path: string, body?: unknown, options: { auth?: boolean } = {}): Promise<T> {
  const useAuth = options.auth !== false
  let res = await send(method, path, body, useAuth ? state.tokens?.access_token ?? null : null)

  if (res.status === 401 && useAuth && state.tokens) {
    const renewed = await refreshOnce()
    if (renewed) {
      res = await send(method, path, body, state.tokens?.access_token ?? null)
    } else {
      state.tokens = null
      state.onExpired?.()
      throw new ApiError(401, 'Your session has expired. Please sign in again.')
    }
  }
  if (!res.ok) throw new ApiError(res.status, await parseError(res))
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T = any>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  put: <T = any>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  delete: <T = any>(path: string) => request<T>('DELETE', path),
  /** For sign-in / sign-up / OTP calls that must not send (or try to refresh) a session. */
  public: {
    post: <T = any>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}, { auth: false }),
  },
}

/** Build a query string, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

export const errorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.') =>
  err instanceof Error && err.message ? err.message : fallback
