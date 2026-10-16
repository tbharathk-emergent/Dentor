/* Clinical work in the Clinic app: /api/clinic-app/{labs,lab-orders,lab-complaints,lab-invoices,recall,rx,prescriptions,certificates,tariff}. */
import { api, qs } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type LabType = 'Blood' | 'X-ray' | 'Dental' | 'CBCT'

export interface Lab {
  id: string
  name: string
  type: LabType
  rating: number | string
  about: string
  services: string[]
  city: string
  phone: string
  turnaround_days: number
  orders?: number
}

export interface LabOptions {
  blood_tests: string[]
  xray_types: string[]
  dental_work: string[]
  cbct_indications: string[]
  fov: string[]
  complaint_types: string[]
}

export interface LabOrder {
  id: string
  code: string
  patient: string
  patientCode: string
  caseType: string
  kind?: LabType
  lab: string
  received: string
  due: string
  due_label: string
  stage: string
  status: string
  amount: number
  paid: number
  balance: number
  teeth: string
  details?: Record<string, unknown>
}

export interface LabComplaint {
  id: string
  code: string
  order_code: string
  patient: string
  patientCode: string
  lab: string
  treatment: string
  type: string
  description: string
  status: 'New' | 'In progress' | 'Resolved'
  created_at: string
  timeline: { status: string; at: string; by: string; note?: string }[]
}

export interface RecallTemplate {
  id: string
  name: string
  text: string
}

export interface Drug {
  id: string
  name: string
  category: string
  type: string
  dosage: string
}

export interface RxMed {
  drug: string
  dose: string
  freq: string
  days: string
  unit: string
  instruction: string
}

export interface RxCatalog {
  drugs: Drug[]
  categories: string[]
  types: string[]
  combos: { id: string; name: string; meds: RxMed[] }[]
  recent: { id: string; code: string; patient: string; patientCode: string; date: string; meds: RxMed[] }[]
}

export interface Certificate {
  id: string
  code: string
  type: 'Fitness' | 'Referral'
  patient: string
  patientCode: string
  age: string | number
  gender: string
  mobile: string
  address: string
  doctor: string
  date: string
  details: Record<string, string>
  clinic?: { name: string; address: string; phone: string; city: string }
}

const B = '/api/clinic-app'

export const useLabs = (type?: LabType) =>
  useQuery<{ items: Lab[]; counts: Record<LabType, number>; options: LabOptions }>({ queryKey: ['clinic-app', 'labs', type ?? ''], queryFn: () => api.get(`${B}/labs${qs({ type })}`) })
export const useLab = (id: string) => useQuery<Lab>({ queryKey: ['clinic-app', 'lab', id], queryFn: () => api.get(`${B}/labs/${id}`), enabled: !!id })
export const useLabOrders = (scope: 'ongoing' | 'completed') =>
  useQuery<{ items: LabOrder[] }>({ queryKey: ['clinic-app', 'lab-orders', scope], queryFn: () => api.get(`${B}/lab-orders?scope=${scope}`) })
export const useLabInvoices = () =>
  useQuery<{ items: LabOrder[]; receipts: Record<string, string | number>[]; totals: { billed: number; paid: number } }>({ queryKey: ['clinic-app', 'lab-invoices'], queryFn: () => api.get(`${B}/lab-invoices`) })
export const useComplaints = (status: 'New' | 'In progress' | 'Resolved') =>
  useQuery<{ items: LabComplaint[]; counts: Record<string, number> }>({ queryKey: ['clinic-app', 'complaints', status], queryFn: () => api.get(`${B}/lab-complaints?status=${encodeURIComponent(status)}`) })
export const useRecallTemplates = () => useQuery<{ items: RecallTemplate[] }>({ queryKey: ['clinic-app', 'recall-templates'], queryFn: () => api.get(`${B}/recall/templates`) })
export const useRxCatalog = () => useQuery<RxCatalog>({ queryKey: ['clinic-app', 'rx-catalog'], queryFn: () => api.get(`${B}/rx/catalog`) })
export const useCertificates = (type: 'Fitness' | 'Referral', q = '') =>
  useQuery<{ items: Certificate[] }>({ queryKey: ['clinic-app', 'certificates', type, q], queryFn: () => api.get(`${B}/certificates${qs({ type, q: q || undefined })}`) })
export const useCertificate = (id: string) =>
  useQuery<Certificate>({ queryKey: ['clinic-app', 'certificate', id], queryFn: () => api.get(`${B}/certificates/${id}`), enabled: !!id })
export const useTariff = () =>
  useQuery<{ groups: { category: string; items: { name: string; code: string; price: number; duration: string | number; unit: string; description: string }[] }[] }>({
    queryKey: ['clinic-app', 'tariff'], queryFn: () => api.get(`${B}/tariff`),
  })

function useWrite<V, R>(call: (vars: V) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: call, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic-app'] }) })
}

export const useBookLab = () =>
  useWrite((body: { patient_id: string; lab_id: string; details: Record<string, unknown>; date?: string; time?: string; notes?: string; attachments?: string[]; declaration: boolean }) =>
    api.post<LabOrder>(`${B}/lab-orders`, body))
export const useRaiseComplaint = () =>
  useWrite((body: { order_id: string; type: string; description: string; attachments?: string[] }) => api.post<LabComplaint>(`${B}/lab-complaints`, body))
export const useComplaintStatus = () =>
  useWrite(({ id, status }: { id: string; status: 'In progress' | 'Resolved' }) => api.post<LabComplaint>(`${B}/lab-complaints/${id}/status`, { status }))
export const useSaveTemplate = () =>
  useWrite(({ id, name, text }: { id?: string; name: string; text: string }) =>
    id ? api.patch<RecallTemplate>(`${B}/recall/templates/${id}`, { name, text }) : api.post<RecallTemplate>(`${B}/recall/templates`, { name, text }))
export const useSendRecall = () =>
  useWrite((body: { patient_id: string; message: string; due?: string; template_id?: string }) =>
    api.post<{ delivered: boolean; channel: string; message: string; patient: string; mobile: string }>(`${B}/recall`, body))
export const useAddDrug = () => useWrite((body: { name: string; category: string; type: string; dosage: string }) => api.post<Drug>(`${B}/rx/drugs`, body))
export const useWritePrescription = () =>
  useWrite((body: { patient_id: string; complaint: string; diagnosis: string; meds: RxMed[]; advice: string; followUp?: string; note: string }) =>
    api.post<{ id: string; code: string }>(`${B}/prescriptions`, body))
export const useIssueCertificate = () => useWrite((body: Record<string, string>) => api.post<Certificate>(`${B}/certificates`, body))
