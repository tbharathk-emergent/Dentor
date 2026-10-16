import type { AppointmentScope } from '@/types'

/**
 * Query keys in one place, so a mutation can invalidate exactly what it changed.
 * `usePatientQuery` appends the active profile's id to each key, so these are prefixes:
 * use them with `invalidateQueries` / `setQueriesData`, not with `setQueryData`.
 */
export const keys = {
  home: ['home'] as const,
  me: ['me'] as const,
  profiles: ['profiles'] as const,
  clinics: ['clinics'] as const,
  clinicSearch: (search: string) => ['clinics', search] as const,
  doctors: ['doctors'] as const,
  slots: ['slots'] as const,
  slotsFor: (doctor: string, date: string) => ['slots', doctor, date] as const,
  appointments: ['appointments'] as const,
  appointmentList: (scope: AppointmentScope) => ['appointments', scope] as const,
  appointment: (id: string) => ['appointment', id] as const,
  records: ['records'] as const,
  prescriptions: ['prescriptions'] as const,
  prescription: (id: string) => ['prescription', id] as const,
  reports: ['reports'] as const,
  report: (id: string) => ['report', id] as const,
  consents: ['consents'] as const,
  invoices: ['invoices'] as const,
  invoice: (id: string) => ['invoice', id] as const,
  chat: ['chat'] as const,
  reviews: ['reviews'] as const,
}
