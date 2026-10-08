import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, qs, type ListResponse } from './api'

export type Doc = Record<string, any> & { id: string }

/** List a collection with optional search / filters. */
export function useList<T = Doc>(resource: string, params: Record<string, any> = {}, options: { enabled?: boolean } = {}) {
  return useQuery<ListResponse<T>>({
    queryKey: [resource, params],
    queryFn: () => api.get<ListResponse<T>>(`/api/${resource}${qs(params)}`),
    enabled: options.enabled,
    placeholderData: (prev) => prev,
  })
}

export function useItem<T = Doc>(resource: string, id: string | undefined) {
  return useQuery<T>({
    queryKey: [resource, 'item', id],
    queryFn: () => api.get<T>(`/api/${resource}/${id}`),
    enabled: !!id,
  })
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

export const todayISO = () => new Date().toISOString().slice(0, 10)

/** Per-clinic settings values (saved from the Settings page). */
export function useSettings() {
  return useQuery<Record<string, any>>({
    queryKey: ['settings'],
    queryFn: () => api.get('/api/settings'),
    staleTime: 60_000,
  })
}

/** Mask a mobile number for lists when the clinic's 'Mask patient identifiers' setting is on. */
export function maskMobile(mobile: string | undefined | null, mask: boolean): string {
  const m = String(mobile ?? '')
  if (!mask || m.length < 6) return m
  return m.slice(0, 2) + '•'.repeat(Math.max(0, m.length - 4)) + m.slice(-2)
}
