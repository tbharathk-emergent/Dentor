import { api } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

/* Requests from clinics (backend/app/routers/consultant_portal.py, "requests from clinics"). */

export interface ConsultRequest {
  id: string
  code: string
  patient: string
  patientCode: string
  choice: 'own' | 'dentor'
  consultant: string
  dentor_type?: string
  dentor_type_label: string
  date: string
  time: string
  date_label: string
  time_label: string
  diagnosis: string
  treatment: string
  teeth: string[]
  quadrants: string[]
  history: string[]
  history_note: string
  lab_findings: string
  vitals: { bp?: string; glucose?: string }
  notes: string
  images: number
  image_data?: string[]
  status: string
  fee: number
  extra_fee?: number
  late_minutes?: number
  proposals: { date: string; time: string; date_label: string; time_label: string }[]
  treatment_provided?: string
  completion_notes?: string
  next_visit?: { id: string; date: string; time: string } | null
  cancelReason?: string
  mine?: boolean
  timeline: { status: string; at: string; by: string; note: string }[]
}

export interface MySlot {
  time: string
  label: string
  part: string
  available: boolean
}

export interface Availability {
  weekly: Record<string, { morning?: [string, string]; evening?: [string, string] }>
  custom: Record<string, [string, string][]>
  is_default: boolean
  updated_at: string
}

export type RequestScope = 'pending' | 'upcoming' | 'previous'

export const useRequests = (scope: RequestScope) =>
  useQuery<{ items: ConsultRequest[]; counts: Record<RequestScope, number> }>({
    queryKey: ['requests', scope],
    queryFn: () => api.get(`/api/consultant/requests?scope=${scope}`),
  })

export const useRequest = (id: string) =>
  useQuery<ConsultRequest>({ queryKey: ['request', id], queryFn: () => api.get(`/api/consultant/requests/${id}`), enabled: !!id })

export const useMySlots = (date: string) =>
  useQuery<{ slots: MySlot[] }>({ queryKey: ['my-slots', date], queryFn: () => api.get(`/api/consultant/my-slots?date=${date}`), enabled: !!date })

export const useAvailability = () => useQuery<Availability>({ queryKey: ['availability'], queryFn: () => api.get('/api/consultant/availability') })

function useRequestAction<V>(path: (vars: V) => string, body: (vars: V) => unknown) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: V) => api.post<ConsultRequest>(path(vars), body(vars)),
    onSuccess: () =>
      Promise.all(['requests', 'request', 'dashboard', 'appointments', 'my-slots'].map((k) => queryClient.invalidateQueries({ queryKey: [k] }))),
  })
}

type Id = { id: string }
export const useAccept = () => useRequestAction((v: Id & { date?: string; time?: string }) => `/api/consultant/requests/${v.id}/accept`, ({ date, time }) => ({ date, time }))
export const usePropose = () =>
  useRequestAction((v: Id & { slots: { date: string; time: string }[]; note: string }) => `/api/consultant/requests/${v.id}/propose`, ({ slots, note }) => ({ slots, note }))
export const useDecline = () => useRequestAction((v: Id & { reason: string }) => `/api/consultant/requests/${v.id}/decline`, ({ reason }) => ({ reason }))
export const useTrack = () =>
  useRequestAction((v: Id & { status: string; minutes?: number }) => `/api/consultant/requests/${v.id}/track`, ({ status, minutes }) => ({ status, minutes: minutes ?? 0 }))
export const useStart = () => useRequestAction((v: Id & { code: string }) => `/api/consultant/requests/${v.id}/start`, ({ code }) => ({ code }))
export const useVitals = () => useRequestAction((v: Id & { bp: string; glucose: string }) => `/api/consultant/requests/${v.id}/vitals`, ({ bp, glucose }) => ({ bp, glucose }))
export const useComplete = () =>
  useRequestAction(
    (v: Id & { treatment_provided: string; notes: string; next_date?: string; next_time?: string }) => `/api/consultant/requests/${v.id}/complete`,
    ({ id: _id, ...rest }) => rest,
  )
export const useCancelRequest = () => useRequestAction((v: Id & { reason: string }) => `/api/consultant/requests/${v.id}/cancel`, ({ reason }) => ({ reason }))

export function useSaveAvailability() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { weekly: Availability['weekly']; custom: Availability['custom']; agreed: boolean }) => api.put<Availability>('/api/consultant/availability', body),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['availability'] }), queryClient.invalidateQueries({ queryKey: ['my-slots'] })]),
  })
}
