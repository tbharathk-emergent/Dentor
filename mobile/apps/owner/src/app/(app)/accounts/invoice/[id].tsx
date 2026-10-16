import { Button, Card, KeyValue, ListRow, QueryState, Screen, Section, StatusBadge, T, colors, fmtDate, fmtINR, space, useLocalSearchParams } from '@dentor/shared'
import { Share, View } from 'react-native'
import { useAccountInvoice } from '@/clinic/accounts'

/** "invoice view" (dentor.fig 202): preview and share. */
export default function InvoiceView() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const invoice = useAccountInvoice(id)
  return (
    <Screen testID="invoice-screen" title="Invoice" back>
      <QueryState query={invoice}>
        {(i) => (
          <>
            <Card>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <T variant="h3">{i.clinic.name}</T>
                <T variant="tiny" color={colors.textMuted}>{[i.clinic.address, i.clinic.city, i.clinic.phone].filter(Boolean).join(' · ')}</T>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm }}>
                <T variant="bodyStrong">{i.number}</T>
                <StatusBadge status={i.status} />
              </View>
              <KeyValue label="Date" value={fmtDate(i.date)} />
              <KeyValue label="Patient" value={`${i.patient} (${i.patientCode})`} />
              <KeyValue label="Treatment" value={i.treatment} />
              <KeyValue label="Doctor" value={i.doctor} />
              <KeyValue label="Total" value={fmtINR(i.total)} strong />
              <KeyValue label="Paid" value={fmtINR(i.paid)} />
              <KeyValue label="Balance" value={fmtINR(i.balance)} />
            </Card>
            <Section title="Receipts">
              {i.receipts.length ? i.receipts.map((r) => <ListRow key={r.receipt} title={`${r.receipt} · ${fmtINR(r.amount)}`} subtitle={`${r.mode} · ${fmtDate(r.date)}${r.reference ? ` · ${r.reference}` : ''}`} />)
                : <T variant="small" color={colors.textMuted}>Nothing paid yet.</T>}
            </Section>
            <Button testID="invoice-share" label="Share" icon="share-2" variant="secondary" full onPress={() =>
              Share.share({ message: `${i.clinic.name}\nInvoice ${i.number} · ${fmtDate(i.date)}\n${i.patient} (${i.patientCode})\n${i.treatment}\nTotal ${fmtINR(i.total)} · Paid ${fmtINR(i.paid)} · Balance ${fmtINR(i.balance)}` }).catch(() => undefined)} />
          </>
        )}
      </QueryState>
    </Screen>
  )
}
