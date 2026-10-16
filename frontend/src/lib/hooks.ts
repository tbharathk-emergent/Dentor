import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, qs, type ListResponse } from './api'

export type Doc = Record<string, any> & { id: string }

/** What a screen reads from a request to tell "loading", "could not load" and "loaded" apart. */
export interface Loadable {
  data: unknown
  error: unknown
  isLoading: boolean
  isError: boolean
  isFetching: boolean
}

/**
 * The state of the requests behind a part of a screen.
 *
 * A request that failed is never "no data": `failed` must be shown as a "could not load" message
 * with a way to try again, not as an empty list or a zero. The shared pieces that do this are in
 * components/ui/bits: `Loaded` (a list or a whole page body), `Figures` (stat tiles) and
 * `LoadError` (the message itself, whose "Try again" sends every failed request on screen again).
 */
export interface LoadState {
  /** The first answer is still on its way. */
  loading: boolean
  /** A request failed and nothing had been loaded before: there is nothing truthful to show. */
  failed: boolean
  /** A refresh failed: what is on screen is the last answer that did arrive. */
  stale: boolean
  /** "Try again" is running. */
  retrying: boolean
  /** Why it failed. */
  error: unknown
}

/** Sums up one or more requests. A request that is switched off (`enabled: false`) counts as neither loading nor failed. */
export function loadState(...queries: (Loadable | null | undefined | false)[]): LoadState {
  const all = queries.filter((q): q is Loadable => Boolean(q))
  const broken = all.filter((q) => q.isError)
  const missing = broken.filter((q) => q.data === undefined)
  return {
    loading: all.some((q) => q.isLoading),
    failed: missing.length > 0,
    stale: broken.length > missing.length,
    retrying: broken.some((q) => q.isFetching),
    error: (missing[0] ?? broken[0])?.error ?? null,
  }
}

/** A query's answer together with its `load` state, so no caller has to work out "failed" by itself. */
function withLoad<T>(query: UseQueryResult<T, Error>) {
  const { data, error, isLoading, isError, isFetching } = query
  return { data, error, isLoading, isError, isFetching, load: loadState(query) }
}

/** List a collection with optional search / filters. */
export function useList<T = Doc>(resource: string, params: Record<string, any> = {}, options: { enabled?: boolean } = {}) {
  return withLoad(
    useQuery<ListResponse<T>>({
      queryKey: [resource, params],
      queryFn: () => api.get<ListResponse<T>>(`/api/${resource}${qs(params)}`),
      enabled: options.enabled,
      placeholderData: (prev) => prev,
    }),
  )
}

export function useItem<T = Doc>(resource: string, id: string | undefined) {
  return withLoad(
    useQuery<T>({
      queryKey: [resource, 'item', id],
      queryFn: () => api.get<T>(`/api/${resource}/${id}`),
      enabled: !!id,
    }),
  )
}

export function useCreate<T = Doc>(resource: string, opts: { successMessage?: string; invalidate?: string[] } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<T>) => api.post<T>(`/api/${resource}`, payload),
    onSuccess: () => {
      for (const key of [resource, ...(opts.invalidate ?? [])]) qc.invalidateQueries({ queryKey: [key] })
      if (opts.successMessage) toast.success(opts.successMessage)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdate<T = Doc>(resource: string, opts: { successMessage?: string; invalidate?: string[] } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<T> & { id: string }) =>
      api.patch<T>(`/api/${resource}/${id}`, payload),
    onSuccess: () => {
      for (const key of [resource, ...(opts.invalidate ?? [])]) qc.invalidateQueries({ queryKey: [key] })
      if (opts.successMessage) toast.success(opts.successMessage)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDelete(resource: string, opts: { successMessage?: string; invalidate?: string[] } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/${resource}/${id}`),
    onSuccess: () => {
      for (const key of [resource, ...(opts.invalidate ?? [])]) qc.invalidateQueries({ queryKey: [key] })
      toast.success(opts.successMessage ?? 'Deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

/** Formatting helpers shared across modules. */
export const fmtINR = (n: number | string | undefined | null) => {
  const v = Number(n ?? 0)
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export const fmtDate = (iso: string | undefined | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const fmtTime = (hhmm: string | undefined | null) => {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (isNaN(h)) return hhmm
  const d = new Date()
  d.setHours(h, m || 0)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

/** yyyy-mm-dd on this device's calendar. Not `toISOString()`: that is the UTC date, which in India
 *  is still yesterday until 05:30, so "today" would open on the wrong day after midnight. */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayISO = () => isoDate(new Date())

/** Per-clinic settings values (saved from the Settings page). */
export function useSettings() {
  return withLoad(
    useQuery<Record<string, any>>({
      queryKey: ['settings'],
      queryFn: () => api.get('/api/settings'),
      staleTime: 60_000,
    }),
  )
}

/** Mask a mobile number for lists when the clinic's 'Mask patient identifiers' setting is on. */
export function maskMobile(mobile: string | undefined | null, mask: boolean): string {
  const m = String(mobile ?? '')
  if (!mask || m.length < 6) return m
  return m.slice(0, 2) + '•'.repeat(Math.max(0, m.length - 4)) + m.slice(-2)
}
