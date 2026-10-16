import { Button, Divider, KeyValue, Sheet, StatusBadge, T, colors, fmtINR, space } from '@dentor/shared'
import { View } from 'react-native'
import type { OutstandingInvoice } from '@/types'

/** Read-only detail of an invoice that still has a balance. Payments are recorded at the front desk. */
export function InvoiceSheet({ invoice, onClose }: { invoice: OutstandingInvoice | null; onClose: () => void }) {
  return (
    <Sheet
      testID="invoice-sheet"
      visible={!!invoice}
      onClose={onClose}
      title={invoice?.number || 'Invoice'}
      subtitle={invoice?.patient}
      footer={<Button testID="invoice-sheet-done" label="Done" variant="secondary" full onPress={onClose} />}
    >
      {invoice && (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.lg, paddingBottom: space.sm }}>
            <T variant="small" color={colors.textMuted}>
              Status
            </T>
            <StatusBadge status={invoice.status} />
          </View>
          <KeyValue label="Patient" value={invoice.patient} />
          <KeyValue label="Doctor" value={invoice.doctor} />
          <KeyValue label="Invoice date" value={invoice.date_label} />
          <Divider />
          <KeyValue label="Invoice total" value={fmtINR(invoice.total)} />
          <KeyValue label="Paid so far" value={fmtINR(invoice.total - invoice.balance)} />
          <KeyValue label="Balance due" value={fmtINR(invoice.balance)} strong />
          <T variant="small" color={colors.textMuted} style={{ paddingTop: space.sm }}>
            Payments are recorded at the front desk in the reception app.
          </T>
        </View>
      )}
    </Sheet>
  )
}
