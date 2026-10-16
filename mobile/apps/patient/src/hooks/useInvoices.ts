import { api } from '@dentor/shared'
import { PATIENT_API } from '@/endpoints'
import { keys } from '@/hooks/keys'
import { usePatientQuery } from '@/hooks/usePatientQuery'
import type { Invoice, InvoicesData } from '@/types'

export function useInvoices() {
  return usePatientQuery<InvoicesData>({ queryKey: keys.invoices, queryFn: () => api.get(`${PATIENT_API}/invoices`) })
}

/** The detail adds the payments made against the invoice and the clinic's contact details. */
export function useInvoice(id: string) {
  return usePatientQuery<Invoice>({
    queryKey: keys.invoice(id),
    queryFn: () => api.get(`${PATIENT_API}/invoices/${id}`),
    enabled: !!id,
  })
}
