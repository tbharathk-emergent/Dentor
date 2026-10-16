import { ApiError, api, errorMessage, qs } from '@dentor/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PATIENT_API } from '@/endpoints'
import { keys } from '@/hooks/keys'
import { usePatientQuery } from '@/hooks/usePatientQuery'
import type { Appointment, AppointmentScope, BookingRequest, Doctor, Slot } from '@/types'

export function useAppointments(scope: AppointmentScope) {
  return usePatientQuery<{ items: Appointment[]; today: string }>({
    queryKey: keys.appointmentList(scope),
    queryFn: () => api.get(`${PATIENT_API}/appointments${qs({ scope })}`),
  })
}

export function useAppointment(id: string) {
  return usePatientQuery<Appointment>({
    queryKey: keys.appointment(id),
    queryFn: () => api.get(`${PATIENT_API}/appointments/${id}`),
    enabled: !!id,
  })
}

export function useDoctors() {
  return usePatientQuery<{ items: Doctor[] }>({
    queryKey: keys.doctors,
    queryFn: () => api.get(`${PATIENT_API}/doctors`),
    staleTime: 5 * 60_000,
  })
}

/** Slots change as other people book, so they are always fetched fresh. */
export function useSlots(doctor: string, date: string) {
  return usePatientQuery<{ slots: Slot[] }>({
    queryKey: keys.slotsFor(doctor, date),
    queryFn: () => api.get(`${PATIENT_API}/slots${qs({ date, doctor })}`),
    enabled: !!doctor && !!date,
    staleTime: 0,
  })
}

/** True when the API refused because the chosen slot is no longer free. */
export const isSlotTaken = (error: unknown) => error instanceof ApiError && error.status === 409

/** What to tell the patient when the chosen slot is gone (by then the slots are reloading). */
export const slotTakenNotice = (error: unknown) => `${errorMessage(error)} The times below are up to date.`

/** True when the clinic has switched online booking off. */
export const isBookingOff = (error: unknown) => error instanceof ApiError && error.status === 403

/**
 * What to refresh after a booking call: on success the lists, the home card and the slots.
 * On a refusal, whatever the screen was showing is out of date: the slots when one had just
 * been taken, and the appointment itself when it could no longer be changed.
 */
function useBookingEffects(id?: string) {
  const qc = useQueryClient()
  return {
    onSuccess: (changed: Appointment) => {
      qc.setQueriesData({ queryKey: keys.appointment(changed.id) }, changed)
      void qc.invalidateQueries({ queryKey: keys.appointments })
      void qc.invalidateQueries({ queryKey: keys.slots })
      void qc.invalidateQueries({ queryKey: keys.home })
    },
    onError: (error: unknown) => {
      if (isSlotTaken(error)) void qc.invalidateQueries({ queryKey: keys.slots })
      else if (id) void qc.invalidateQueries({ queryKey: keys.appointment(id) })
    },
  }
}

export function useBookAppointment() {
  return useMutation({
    mutationFn: (body: BookingRequest) => api.post<Appointment>(`${PATIENT_API}/appointments`, body),
    ...useBookingEffects(),
  })
}

export function useCancelAppointment(id: string) {
  return useMutation({
    mutationFn: (reason: string) => api.post<Appointment>(`${PATIENT_API}/appointments/${id}/cancel`, { reason }),
    ...useBookingEffects(id),
  })
}

export function useRescheduleAppointment(id: string) {
  return useMutation({
    mutationFn: (when: { date: string; time: string }) =>
      api.post<Appointment>(`${PATIENT_API}/appointments/${id}/reschedule`, when),
    ...useBookingEffects(id),
  })
}
