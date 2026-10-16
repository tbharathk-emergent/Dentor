import { Card, EmptyState, KeyValue, QueryState, Screen, Section, Sheet, StatusBadge, TextField, colors, face, fmtDate, fmtINR, radius, shadow, space, stripeColors } from '@dentor/shared'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useLabInvoices, type LabOrder } from '@/clinic/clinical'
import { useRefresh } from '@/hooks/useRefresh'

/**
 * "Invoice" (dentor.fig 188): search, then one green-edged card per lab order with its order number, date and
 * patient, and the design's two buttons: "Reciept" (what has been paid) and "Invoice" (what the work costs).
 * The totals stay above the list. Receipts recorded at the lab desk are listed under the cards.
 */
export default function LabInvoices() {
  const invoices = useLabInvoices()
  const { refreshing, refresh } = useRefresh(invoices)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<{ order: LabOrder; kind: 'receipt' | 'invoice' } | null>(null)
  return (
    <Screen testID="lab-invoices-screen" title="Invoice" back refreshing={refreshing} onRefresh={refresh}>
      <TextField testID="lab-invoice-search" icon="search" value={q} onChangeText={setQ} placeholder="Search order, patient or lab" autoCapitalize="none" />
      <QueryState query={invoices}>
        {(data) => {
          const term = q.trim().toLowerCase()
          const items = data.items.filter((o) => !term || [o.code, o.patient, o.patientCode, o.lab].some((v) => v?.toLowerCase().includes(term)))
          return (
            <>
              <Card>
                <KeyValue label="Billed" value={fmtINR(data.totals.billed)} />
                <KeyValue label="Paid" value={fmtINR(data.totals.paid)} />
                <KeyValue label="Balance" value={fmtINR(data.totals.billed - data.totals.paid)} strong />
              </Card>
              {items.length ? (
                <View style={{ gap: space.md }}>
                  {items.map((o) => (
                    <View key={o.id} testID={`lab-invoice-${o.code}`} style={[styles.card, { borderLeftColor: o.balance > 0 ? stripeColors.progress : stripeColors.done }]}>
                      <View style={styles.text}>
                        <Text style={styles.line} numberOfLines={1}>Order {o.code}</Text>
                        <Text style={styles.line} numberOfLines={1}>{fmtDate(o.received)}</Text>
                        <Text style={styles.line} numberOfLines={1}>{o.patient} / {o.patientCode}</Text>
                        <Text style={styles.line} numberOfLines={1}>{o.lab} · {fmtINR(o.amount)}</Text>
                      </View>
                      <View style={styles.buttons}>
                        <Pressable testID={`lab-receipt-${o.code}`} accessibilityRole="button" accessibilityLabel={`Receipt for ${o.code}`}
                          onPress={() => setOpen({ order: o, kind: 'receipt' })} style={[styles.button, o.paid > 0 ? styles.solid : styles.outline]}>
                          <Text style={[styles.buttonText, o.paid > 0 && { color: '#ffffff' }]}>Receipt</Text>
                        </Pressable>
                        <Pressable testID={`lab-invoice-open-${o.code}`} accessibilityRole="button" accessibilityLabel={`Invoice for ${o.code}`}
                          onPress={() => setOpen({ order: o, kind: 'invoice' })} style={[styles.button, o.paid > 0 ? styles.outline : styles.solid]}>
                          <Text style={[styles.buttonText, !(o.paid > 0) && { color: '#ffffff' }]}>Invoice</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : <EmptyState icon="file-text" title={term ? 'No invoice matches' : 'No lab invoices'} />}
              {data.receipts.length > 0 && (
                <Section title="Receipts from the lab desk">
                  <Card>{data.receipts.map((r, i) => <KeyValue key={i} label={`${r.receipt ?? ''} · ${r.lab ?? ''} · ${r.date ?? ''}`} value={fmtINR(Number(r.amount))} />)}</Card>
                </Section>
              )}
            </>
          )
        }}
      </QueryState>
      <Sheet testID="lab-invoice-sheet" visible={!!open} onClose={() => setOpen(null)}
        title={open ? `${open.kind === 'receipt' ? 'Receipt' : 'Invoice'} · ${open.order.code}` : ''} subtitle={open ? `${open.order.patient} · ${open.order.lab}` : ''}>
        {open && (open.kind === 'invoice' ? (
          <>
            <KeyValue label="Work" value={`${open.order.caseType}${open.order.teeth ? ` · ${open.order.teeth}` : ''}`} />
            <KeyValue label="Received" value={fmtDate(open.order.received)} />
            <KeyValue label="Due" value={open.order.due_label} />
            <KeyValue label="Amount" value={fmtINR(open.order.amount)} strong />
          </>
        ) : (
          <>
            <KeyValue label="Paid" value={fmtINR(open.order.paid)} strong />
            <KeyValue label="Balance" value={fmtINR(open.order.balance)} />
            <StatusBadge status={open.order.balance > 0 ? (open.order.paid > 0 ? 'Partially Paid' : 'Unpaid') : 'Paid'} />
          </>
        ))}
      </Sheet>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 6, ...shadow },
  text: { flex: 1, minWidth: 0, gap: 2 },
  line: { ...face('regular'), fontSize: 13, color: colors.text },
  buttons: { gap: space.sm },
  button: { minWidth: 88, minHeight: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  solid: { backgroundColor: colors.header },
  outline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  buttonText: { ...face('semibold'), fontSize: 14, color: colors.header },
})
