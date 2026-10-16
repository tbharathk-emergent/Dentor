import { QueryState, Screen } from '@dentor/shared'
import { InvoiceDetails } from '@/components/payments/InvoiceDetails'
import { useInvoice } from '@/hooks/useInvoices'
import { useRefresh } from '@/hooks/useRefresh'
import { useLocalSearchParams } from '@/nav'

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const invoice = useInvoice(id)
  const { refreshing, onRefresh } = useRefresh(invoice.refetch)

  return (
    <Screen testID="invoice-screen" title="Bill" subtitle={invoice.data?.treatment} back refreshing={refreshing} onRefresh={onRefresh}>
      <QueryState query={invoice}>{(data) => <InvoiceDetails invoice={data} />}</QueryState>
    </Screen>
  )
}
