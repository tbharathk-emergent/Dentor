/** Query keys in one place so mutations invalidate exactly what they changed. */
export const keys = {
  dashboard: ['dashboard'] as const,
  /** Prefix of every appointment list (a day or a date range). */
  appointmentLists: ['appointments'] as const,
  appointmentsOn: (date: string) => ['appointments', 'day', date] as const,
  appointmentsBetween: (from: string, to: string) => ['appointments', 'range', from, to] as const,
  appointment: (id: string) => ['appointment', id] as const,
  patients: (q: string) => ['patients', q] as const,
  /** Prefix of every patient detail. */
  patientDetails: ['patient'] as const,
  patient: (id: string) => ['patient', id] as const,
  patientFile: (patientId: string, fileId: string) => ['patient-file', patientId, fileId] as const,
  prescriptions: ['prescriptions'] as const,
  prescription: (id: string, patientId: string) => ['prescription', id, patientId] as const,
  catalog: ['catalog'] as const,
  bookings: ['bookings'] as const,
  /** Prefix of every earnings period. */
  earningsAll: ['earnings'] as const,
  earnings: (from: string, to: string) => ['earnings', from, to] as const,
  me: ['me'] as const,
}
