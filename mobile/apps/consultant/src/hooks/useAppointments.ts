import { api, qs } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Appointment, AppointmentDetail, AppointmentStatus } from '@/types'
import { keys } from './keys'

export function useDayAppointments(date: string) {
  return useQuery<{ items: Appointment[] }>({
    queryKey: keys.appointmentsOn(date),
    queryFn: () => api.get(`/api/consultant/appointments${qs({ date })}`),
  })
}

export function useRangeAppointments(from: string, to: string) {
  return useQuery<{ items: Appointment[] }>({
    queryKey: keys.appointmentsBetween(from, to),
    queryFn: () => api.get(`/api/consultant/appointments${qs({ date_from: from, date_to: to })}`),
  })
}

export function useAppointment(id: string | undefined) {
  return useQuery<AppointmentDetail>({
    queryKey: keys.appointment(id ?? ''),
    queryFn: () => api.get(`/api/consultant/appointments/${id}`),
    enabled: !!id,
  })
}

export interface StatusChange {
  status: AppointmentStatus | string
  /** Visit notes are stored by the same call; omit to leave them as they are. */
  notes?: string
}

/** Moves an appointment to another status (and/or saves its visit notes). */
export function useSetAppointmentStatus(id: string) {
  const qc = useQueryClient()
  return useMutation<Appointment, Error, StatusChange>({
    mutationFn: (change) => api.post(`/api/consultant/appointments/${id}/status`, change),
    onSuccess: (updated) => {
      qc.setQueryData<AppointmentDetail>(keys.appointment(id), (old) => (old ? { ...old, ...updated } : old))
      // Everything that lists or counts appointments.
      void qc.invalidateQueries({ queryKey: keys.dashboard })
      void qc.invalidateQueries({ queryKey: keys.appointmentLists })
      void qc.invalidateQueries({ queryKey: keys.patientDetails })
      void qc.invalidateQueries({ queryKey: keys.earningsAll })
    },
  })
}
