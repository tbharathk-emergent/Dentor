import { Card, Divider, KeyValue, Section, StatusBadge, T, colors, fmtDate, fmtINR, space } from '@dentor/shared'
import { Fragment } from 'react'
import { StyleSheet, View } from 'react-native'
import { PayAtClinic } from '@/components/payments/PayAtClinic'
import { PaymentList } from '@/components/payments/PaymentList'
import type { Invoice, InvoiceLine } from '@/types'

const lineAmount = (line: InvoiceLine) => line.qty * line.price

/** A bill in full: what was charged, the totals, what has been received and how to pay the rest. */
export function InvoiceDetails({ invoice }: { invoice: Invoice }) {
  return (
    <>
      <Card style={styles.card}>
        <View style={styles.head}>
          <View style={styles.title}>
            <T variant="h2" testID="invoice-number">{invoice.number}</T>
            <T variant="small" color={colors.textMuted}>{[fmtDate(invoice.date), invoice.doctor].filter(Boolean).join(' · ')}</T>
          </View>
          <View testID="invoice-status">
            <StatusBadge status={invoice.status} />
          </View>
        </View>

        <View testID="invoice-lines">
          {invoice.items.map((line, index) => (
            <Fragment key={`${line.name}-${index}`}>
              <Divider />
              <View testID="invoice-line" style={styles.line}>
                <View style={styles.lineText}>
                  <T variant="smallStrong">{line.name}</T>
                  <T variant="small" color={colors.textMuted}>
                    {line.qty} × {fmtINR(line.price)}
                    {line.tax > 0 ? ` · ${line.tax}% tax` : ''}
                  </T>
                </View>
                <T variant="smallStrong">{fmtINR(lineAmount(line))}</T>
              </View>
            </Fragment>
          ))}
          <Divider />
        </View>

        <View>
          <KeyValue label="Subtotal" value={fmtINR(invoice.subtotal)} />
          {invoice.discount > 0 && <KeyValue label="Discount" value={`− ${fmtINR(invoice.discount)}`} />}
          {invoice.tax > 0 && <KeyValue label="Tax" value={fmtINR(invoice.tax)} />}
          <KeyValue label="Total" value={fmtINR(invoice.total)} strong />
          <KeyValue label="Paid" value={fmtINR(invoice.paid)} />
          <View style={styles.balance}>
            <T variant="bodyStrong">{invoice.balance > 0 ? 'Still to pay' : 'Balance'}</T>
            <T variant="h3" color={invoice.balance > 0 ? colors.amber : colors.green} testID="invoice-balance">{fmtINR(invoice.balance)}</T>
          </View>
        </View>
        {!!invoice.notes && <T variant="small" color={colors.textMuted}>{invoice.notes}</T>}
      </Card>

      <Section title="Payments received">
        <PaymentList payments={invoice.payments ?? []} emptyText="No payment has been recorded for this bill yet." />
      </Section>

      <PayAtClinic phone={invoice.clinic?.phone} outstanding={invoice.balance} />
    </>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  title: { flex: 1, minWidth: 0, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm },
  lineText: { flex: 1, minWidth: 0, gap: 2 },
  balance: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg, paddingTop: space.sm },
})
