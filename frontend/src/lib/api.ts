const TOKEN_KEY = 'dentor.token'
const USER_KEY = 'dentor.user'
const CLINIC_KEY = 'dentor.clinic'

export interface ActiveClinic {
  id: string
  name: string
  code?: string
}

/** The clinic a super admin is currently managing (ignored by the API for clinic users). */
export function getActiveClinic(): ActiveClinic | null {
  try {
    const raw = localStorage.getItem(CLINIC_KEY)
    return raw ? (JSON.parse(raw) as ActiveClinic) : null
  } catch {
    return null
  }
}
export function setActiveClinic(clinic: ActiveClinic | null) {
  if (clinic) localStorage.setItem(CLINIC_KEY, JSON.stringify(clinic))
  else localStorage.removeItem(CLINIC_KEY)
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setSession(token: string, user: unknown) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
export function getStoredUser<T = Record<string, unknown>>(): T | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(CLINIC_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const clinic = getActiveClinic()
  if (clinic) headers['X-Clinic-Id'] = clinic.id
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // A 401 means the session is gone — except on auth endpoints themselves, where it
  // just means a wrong password (login, verify-password) and must not log the user out.
  if (res.status === 401 && !path.includes('/api/auth/')) {
    clearSession()
    if (!location.pathname.startsWith('/login')) location.assign('/login')
    throw new ApiError(401, 'Session expired')
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') detail = data.detail
      else if (Array.isArray(data.detail)) detail = data.detail[0]?.msg || detail
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

export interface ListResponse<T> {
  items: T[]
  total: number
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
