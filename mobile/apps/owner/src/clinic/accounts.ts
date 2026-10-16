/* Accounts in the Clinic app: /api/clinic-app/accounts/* and /api/expenses (backend/app/routers/clinic_accounts.py). */
import { api, qs } from '@dentor/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DateRange } from '@/types'

export const EXPENSE_CATEGORIES = ['Consultant', 'Duty Doctors', 'Purchase', 'Lab Orders', 'Miscellaneous', 'Staff', 'Domestic'] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export interface AccountsSummary {
  from: string
  to: string
  billed: number
  collected: number
  collected_change: number | null
  expenses: number
  expenses_change: number | null
  net: number
  categories: { category: ExpenseCategory; amount: number; entries: number }[]
  dentor: { completed: number; pending: number; cancelled: number }
}

export interface ExpenseLine {
  id: string
  source: 'Recorded' | 'Lab order' | 'Consultant visit'
  date: string
  date_label: string
  category: ExpenseCategory
  payee: string
  description: string
  amount: number
  mode: string
  reference: string
  code: string
}

export interface InvoiceRow { id: string; number: string; date: string; date_label: string; patient: string; patientCode: string; treatment: string; doctor: string; total: number; paid: number; balance: number; status: string }
export interface ReceiptRow { id: string; receipt: string; date: string; date_label: string; patient: string; patientCode: string; invoice: string; mode: string; amount: number; reference: string }
export interface StatementRow { date: string; date_label: string; kind: string; reference: string; party: string; detail: string; in: number; out: number; balance: number }
export interface DentorRow { id: string; code: string; date: string; date_label: string; patient: string; patientCode: string; consultant: string; treatment: string; fee: number; status: string }

const B = '/api/clinic-app/accounts'
const range = (r: DateRange) => ({ date_from: r.from, date_to: r.to })

export const useAccountsSummary = (r: DateRange) =>
  useQuery<AccountsSummary>({ queryKey: ['clinic-app', 'accounts', 'summary', r.from, r.to], queryFn: () => api.get(`${B}/summary${qs(range(r))}`), placeholderData: keepPreviousData })
export const useExpenses = (r: DateRange, category?: string) =>
  useQuery<{ items: ExpenseLine[]; total: number }>({ queryKey: ['clinic-app', 'accounts', 'expenses', r.from, r.to, category ?? ''], queryFn: () => api.get(`${B}/expenses${qs({ ...range(r), category })}`) })
export const useAccountInvoices = (r: DateRange, q = '') =>
  useQuery<{ items: InvoiceRow[] }>({ queryKey: ['clinic-app', 'accounts', 'invoices', r.from, r.to, q], queryFn: () => api.get(`${B}/invoices${qs({ ...range(r), q: q || undefined })}`) })
export const useAccountInvoice = (id: string) =>
  useQuery<InvoiceRow & { items?: { name?: string; treatment?: string; qty?: number; price?: number; amount?: number }[]; subtotal?: number; discount?: number; tax?: number; receipts: { receipt: string; date: string; mode: string; amount: number; reference: string }[]; clinic: { name: string; address: string; city: string; phone: string } }>({
    queryKey: ['clinic-app', 'accounts', 'invoice', id], queryFn: () => api.get(`${B}/invoices/${id}`), enabled: !!id,
  })
export const useReceipts = (r: DateRange) =>
  useQuery<{ items: ReceiptRow[] }>({ queryKey: ['clinic-app', 'accounts', 'receipts', r.from, r.to], queryFn: () => api.get(`${B}/receipts${qs(range(r))}`) })
export const useStatement = (r: DateRange | null) =>
  useQuery<{ from: string; to: string; rows: StatementRow[]; billed: number; received: number; paid_out: number; net: number }>({
    queryKey: ['clinic-app', 'accounts', 'statement', r?.from, r?.to], queryFn: () => api.get(`${B}/statement${qs(range(r!))}`), enabled: !!r,
  })
export const useDentorAccounts = (status: 'completed' | 'pending' | 'cancelled', r: DateRange) =>
  useQuery<{ items: DentorRow[]; total: number }>({ queryKey: ['clinic-app', 'accounts', 'dentor', status, r.from, r.to], queryFn: () => api.get(`${B}/dentor${qs({ status, ...range(r) })}`) })

export function useAddExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { category: string; amount: number; payee: string; description: string; mode: string; reference: string; date: string }) => api.post(`/api/expenses`, body),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['clinic-app', 'accounts'] }), queryClient.invalidateQueries({ queryKey: ['owner'] })]),
  })
}
