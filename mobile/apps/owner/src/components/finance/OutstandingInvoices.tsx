import { Card, Divider, EmptyState, ListRow, Section, StatusBadge, T, colors, fmtINR, space } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { BadgeStack } from '@/components/BadgeStack'
import { ExpandableList } from '@/components/ExpandableList'
import { InvoiceSheet } from '@/components/finance/InvoiceSheet'
import { plural } from '@/lib/format'
import type { OutstandingInvoice } from '@/types'

/** Every invoice with a balance (oldest first, whatever period is chosen); a row opens its detail. */
export function OutstandingInvoices({ invoices, total }: { invoices: OutstandingInvoice[]; total: number }) {
  const [open, setOpen] = useState<OutstandingInvoice | null>(null)
  return (
    <Section title="Outstanding invoices">
      <Card padded={false} testID="outstanding-card">
        {invoices.length === 0 ? (
          <EmptyState testID="outstanding-empty" icon="check-circle" title="Nothing outstanding" message="Every invoice has been paid in full." />
        ) : (
          <>
            <View style={{ padding: space.lg, gap: 2 }}>
              <T variant="h2" testID="outstanding-total">
                {fmtINR(total)}
              </T>
              <T variant="small" color={colors.textMuted} testID="outstanding-count">
                {`Due on ${plural(invoices.length, 'invoice')} · all dates, oldest first`}
              </T>
            </View>
            <Divider />
            <ExpandableList
              testID="outstanding-list"
              items={invoices}
              keyOf={(invoice) => invoice.id}
              render={(invoice) => (
                <ListRow
                  testID="outstanding-invoice"
                  title={invoice.patient || 'Unnamed patient'}
                  subtitle={`${invoice.number} · ${invoice.date_label}`}
                  right={
                    <BadgeStack>
                      <T variant="bodyStrong" testID="outstanding-balance">
                        {fmtINR(invoice.balance)}
                      </T>
                      <StatusBadge status={invoice.status} />
                    </BadgeStack>
                  }
                  chevron
                  onPress={() => setOpen(invoice)}
                />
              )}
            />
          </>
        )}
      </Card>
      <InvoiceSheet invoice={open} onClose={() => setOpen(null)} />
    </Section>
  )
}
