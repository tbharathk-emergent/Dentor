import { EmptyState, QueryState, Screen, Section, TextField } from '@dentor/shared'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Rows } from '@/components/Rows'
import { InvoiceCard } from '@/components/payments/InvoiceCard'
import { MoneySummary } from '@/components/payments/MoneySummary'
import { PayAtClinic } from '@/components/payments/PayAtClinic'
import { PaymentList } from '@/components/payments/PaymentList'
import { useInvoices } from '@/hooks/useInvoices'
import { useMe } from '@/hooks/useMe'
import { useRefresh } from '@/hooks/useRefresh'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'
import { PatientHeader } from '@/components/PatientHeader'
import { useRouter } from '@/nav'
import type { Invoice } from '@/types'

export default function Payments() {
  const router = useRouter()
  const invoices = useInvoices()
  const me = useMe()
  const { refreshing, onRefresh } = useRefresh(invoices.refetch)
  // A tab stays mounted: coming back to it shows fresh data.
  useRefreshOnFocus(invoices.refetch)
  const summary = invoices.data?.summary
  const [search, setSearch] = useState('')
  const wanted = search.trim().toLowerCase()

  return (
    <Screen
      testID="payments-screen"
      header={<PatientHeader clinicName={me.data?.clinic.name} />}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <QueryState query={invoices}>
        {(data) => (
          <>
            {summary && <MoneySummary paid={summary.paid} outstanding={summary.outstanding} />}
            {data.items.length > 0 && (
              <View style={styles.search}>
                <TextField testID="invoice-search" value={search} onChangeText={setSearch} placeholder="Search" icon="search" autoCapitalize="none" maxLength={60} />
              </View>
            )}
            <Section>
              {data.items.length === 0 ? (
                <EmptyState testID="invoices-empty" icon="credit-card" title="No bills yet" message="Bills for your treatments appear here." />
              ) : (
                <Bills
                  invoices={data.items.filter((invoice) => !wanted || `${invoice.treatment} ${invoice.number}`.toLowerCase().includes(wanted))}
                  search={search.trim()}
                  onOpen={(id) => router.push({ pathname: '/payments/[id]', params: { id } })}
                />
              )}
            </Section>
            <PayAtClinic phone={me.data?.clinic.phone} outstanding={data.summary.outstanding} />
            {data.items.length > 0 && (
              <Section title="Payments received">
                <PaymentList payments={data.payments} emptyText="The clinic has not recorded any payments yet." />
              </Section>
            )}
          </>
        )}
      </QueryState>
    </Screen>
  )
}

function Bills({ invoices, search, onOpen }: { invoices: Invoice[]; search: string; onOpen: (id: string) => void }) {
  if (invoices.length === 0) {
    return <EmptyState testID="invoices-no-match" icon="search" title={`No bill matches “${search}”`} message="Search by treatment or invoice number." />
  }
  return (
    <Rows testID="invoice-list">
      {invoices.map((invoice) => (
        <InvoiceCard key={invoice.id} invoice={invoice} onPress={() => onOpen(invoice.id)} />
      ))}
    </Rows>
  )
}

const styles = StyleSheet.create({
  // design: a small centred search box, 133 pt wide, radius 10, outlined #aca4a4
  search: { alignSelf: 'center', width: '60%', minWidth: 200 },
})
