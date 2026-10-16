/* Booking a visiting consultant: /api/clinic-app/consult/* (backend/app/consult.py). */
import { api, qs } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface VisitingConsultant {
  id: string
  code: string
  name: string
  specialty: string
  credentials: string
  experience: string | number
  location: string
  fee: number
  rating: string | number
  cases: number
}

export interface DentorType {
  key: 'standard' | 'peak' | 'preferred'
  label: string
  window: string
  extra: number
}

export interface ConsultantProfile extends VisitingConsultant {
  about: string
  services: string[]
  reviews: { by: string; rating: string | number; text: string }[]
}

export interface ConsultSlot {
  time: string
  label: string
  part: 'Morning' | 'Afternoon' | 'Evening'
  available: boolean
}

export interface ConsultBooking {
  id: string
  code: string
  patient: string
  patientCode: string
  choice: 'own' | 'dentor'
  consultant: string
  specialty: string
  fee: number
  extra_fee?: number
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
  status: string
  late_minutes?: number
  proposals: { date: string; time: string; date_label: string; time_label: string }[]
  proposal_note?: string
  start_code?: string
  treatment_provided?: string
  completion_notes?: string
  next_visit?: { id: string; date: string; time: string } | null
  cancelReason?: string
  timeline: { status: string; at: string; by: string; note: string }[]
}

export interface NewConsultRequest {
  patient_id: string
  choice: 'own' | 'dentor'
  consultant_id?: string
  date?: string
  time?: string
  dentor_type?: string
  diagnosis?: string
  treatment: string
  teeth: string[]
  quadrants: string[]
  history: string[]
  history_note?: string
  lab_findings?: string
  bp?: string
  glucose?: string
  notes?: string
  images: string[]
  declaration: boolean
}

const BASE = '/api/clinic-app/consult'

export const useVisiting = (specialty = '') =>
  useQuery<{ items: VisitingConsultant[]; types: DentorType[] }>({
    queryKey: ['clinic-app', 'consult', 'consultants', specialty],
    queryFn: () => api.get(`${BASE}/consultants${qs({ specialty: specialty || undefined })}`),
  })

export const useConsultantProfile = (id: string) =>
  useQuery<ConsultantProfile>({ queryKey: ['clinic-app', 'consult', 'profile', id], queryFn: () => api.get(`${BASE}/consultants/${id}`), enabled: !!id })

export const useConsultSlots = (id: string, date: string) =>
  useQuery<{ slots: ConsultSlot[] }>({
    queryKey: ['clinic-app', 'consult', 'slots', id, date],
    queryFn: () => api.get(`${BASE}/consultants/${id}/slots?date=${date}`),
    enabled: !!id && !!date,
  })

export const useConsultRequests = (scope: 'active' | 'past') =>
  useQuery<{ items: ConsultBooking[] }>({ queryKey: ['clinic-app', 'consult', 'requests', scope], queryFn: () => api.get(`${BASE}/requests?scope=${scope}`) })

export const useConsultRequest = (id: string) =>
  useQuery<ConsultBooking>({
    queryKey: ['clinic-app', 'consult', 'request', id],
    queryFn: () => api.get(`${BASE}/requests/${id}`),
    enabled: !!id,
    // the consultant's tracking updates arrive by themselves while the screen is open
    refetchInterval: 20000,
  })

function useConsultMutation<V, R>(call: (vars: V) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: call, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic-app'] }) })
}

export const useSendRequest = () => useConsultMutation((body: NewConsultRequest) => api.post<ConsultBooking>(`${BASE}/requests`, body))
export const useAcceptProposal = () =>
  useConsultMutation(({ id, index }: { id: string; index: number }) => api.post<ConsultBooking>(`${BASE}/requests/${id}/accept-proposal`, { index }))
export const useCancelRequest = () =>
  useConsultMutation(({ id, reason }: { id: string; reason: string }) => api.post<ConsultBooking>(`${BASE}/requests/${id}/cancel`, { reason }))

/** dentor.fig "Tooth" (4019:2334) lists the FDI numbers; "medical history" (4019:2434) the conditions. */
export const TEETH = [
  ...[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  ...[48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
].map(String)
export const QUADRANTS = [
  { key: '1', label: 'Quadrant 1' },
  { key: '2', label: 'Quadrant 2' },
  { key: '3', label: 'Quadrant 3' },
  { key: '4', label: 'Quadrant 4' },
  { key: 'full', label: 'Full mouth' },
]
export const HISTORY = ['Heart disease', 'High blood pressure', 'Low blood pressure', 'Diabetes', 'Asthma', 'Bleeding disorder', 'Pregnancy', 'Thyroid', 'Epilepsy', 'Allergies']
export const TREATMENTS = ['Root Canal Treatment', 'Fixed Braces', 'Clear Aligners', 'Implant', 'Extraction (Surgical)', 'Crown preparation & fixing', 'Gum Surgery', 'Full Mouth Rehabilitation']
