import { api, qs } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AppointmentDetail, AppointmentList, ClinicAppointment, DaySlot, Doctor, Kind, MonthView, NewPatient, PatientDashboard, PatientList, PatientRow, Scope,
} from './types'

const BASE = '/api/clinic-app'

export function useAppointments(scope: Scope, kind?: Kind, q = '', date?: string) {
  return useQuery<AppointmentList>({
    queryKey: ['clinic-app', 'appointments', scope, kind ?? 'all', q, date ?? ''],
    queryFn: () => api.get(`${BASE}/appointments${qs({ scope, kind, q: q || undefined, date })}`),
  })
}

export function useAppointment(id: string) {
  return useQuery<AppointmentDetail>({ queryKey: ['clinic-app', 'appointment', id], queryFn: () => api.get(`${BASE}/appointments/${id}`), enabled: !!id })
}

export function useMonth(month: string) {
  return useQuery<MonthView>({ queryKey: ['clinic-app', 'month', month], queryFn: () => api.get(`${BASE}/appointments/month?month=${month}`) })
}

export function useDoctors() {
  return useQuery<{ items: Doctor[] }>({ queryKey: ['clinic-app', 'doctors'], queryFn: () => api.get(`${BASE}/doctors`) })
}

export function useSlots(date: string, doctor: string, ignore?: string) {
  return useQuery<{ slots: DaySlot[] }>({
    queryKey: ['clinic-app', 'slots', date, doctor, ignore ?? ''],
    queryFn: () => api.get(`${BASE}/slots${qs({ date, doctor, ignore })}`),
    enabled: !!date && !!doctor,
  })
}

/** Every change to an appointment refreshes the lists, the month, the slots and the figures. */
function useAppointmentMutation<V, R>(call: (vars: V) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: call,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clinic-app'] }),
        queryClient.invalidateQueries({ queryKey: ['owner'] }),
      ]),
  })
}

export interface BookVars {
  patient_id: string
  doctor: string
  date?: string
  time?: string
  treatment?: string
  notes?: string
  draft?: boolean
}

export const useBook = () => useAppointmentMutation((vars: BookVars) => api.post<ClinicAppointment>(`${BASE}/appointments`, vars))
export const useReschedule = () =>
  useAppointmentMutation(({ id, ...body }: { id: string; date: string; time: string; reason?: string; doctor?: string }) =>
    api.post<ClinicAppointment>(`${BASE}/appointments/${id}/reschedule`, body))
export const useSwap = () =>
  useAppointmentMutation(({ id, other_id }: { id: string; other_id: string }) => api.post(`${BASE}/appointments/${id}/swap`, { other_id }))
export const useCancel = () =>
  useAppointmentMutation(({ id, ...body }: { id: string; reason: string; refund_note?: string }) => api.post(`${BASE}/appointments/${id}/cancel`, body))
export const useSetStatus = () =>
  useAppointmentMutation(({ id, status }: { id: string; status: 'Waiting' | 'Completed' | 'Scheduled' }) =>
    api.post<ClinicAppointment>(`${BASE}/appointments/${id}/status`, { status }))

export function usePatients(q = '') {
  return useQuery<PatientList>({ queryKey: ['clinic-app', 'patients', q], queryFn: () => api.get(`${BASE}/patients${qs({ q: q || undefined })}`) })
}

export function usePatient(id: string) {
  return useQuery<PatientDashboard>({ queryKey: ['clinic-app', 'patient', id], queryFn: () => api.get(`${BASE}/patients/${id}`), enabled: !!id })
}

export const useAddPatient = () => useAppointmentMutation((body: NewPatient) => api.post<PatientRow>(`${BASE}/patients`, body))

/** "Re-Visit" (dentor.fig 3879:2429): each treated patient once, with the latest completed visit. */
export interface RevisitRow {
  patient_id: string; patient: string; patient_code: string; mobile: string; treatment: string; doctor: string
  date: string; date_label: string; time_label: string; last_visit: string; last_visit_label: string
}
export function useRevisits(q = '') {
  return useQuery<{ items: RevisitRow[] }>({ queryKey: ['clinic-app', 'revisits', q], queryFn: () => api.get(`${BASE}/revisits${qs({ q: q || undefined })}`) })
}
