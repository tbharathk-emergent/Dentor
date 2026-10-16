import { Banner, Button, Card, ErrorState, KeyValue, ListRow, Screen, SkeletonList, TextField, fmtINR, space, todayISO } from '@dentor/shared'
import { useState } from 'react'
import { Share, View } from 'react-native'
import { useStatement } from '@/clinic/accounts'
import type { DateRange } from '@/types'

/** "Statement of accounts" (dentor.fig 211–212): from and to dates, generate, the lines with a running balance, share. */
export default function Statement() {
  const [from, setFrom] = useState(`${todayISO().slice(0, 8)}01`)
  const [to, setTo] = useState(todayISO())
  const [range, setRange] = useState<DateRange | null>(null)
  const [error, setError] = useState<string | null>(null)
  const statement = useStatement(range)
  const generate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return setError('Use the form yyyy-mm-dd.')
    if (from > to) return setError('The from date must be before the to date.')
    setError(null)
    setRange({ from, to })
  }
  const s = statement.data
  return (
    <Screen testID="statement-screen" title="Statement of Accounts" back>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><TextField testID="statement-from" label="From Date" value={from} onChangeText={setFrom} maxLength={10} /></View>
        <View style={{ flex: 1 }}><TextField testID="statement-to" label="To Date" value={to} onChangeText={setTo} maxLength={10} /></View>
      </View>
      <Button testID="statement-generate" label="Generate" full onPress={generate} />
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
      {range && (statement.isLoading ? <SkeletonList /> : statement.isError || !s ? <ErrorState error={statement.error} onRetry={() => statement.refetch()} /> : (
        <>
          <Card>
            <KeyValue label="Billed" value={fmtINR(s.billed)} />
            <KeyValue label="Received" value={fmtINR(s.received)} />
            <KeyValue label="Paid out" value={fmtINR(s.paid_out)} />
            <KeyValue label="Net" value={fmtINR(s.net)} strong />
          </Card>
          <View testID="statement-rows" style={{ gap: space.xs }}>
            {s.rows.map((r, i) => (
              <ListRow key={i} title={`${r.kind} · ${r.party}`} subtitle={[r.reference, r.detail].filter(Boolean).join(' · ')}
                meta={`${r.date_label} · ${r.in ? `+${fmtINR(r.in)}` : `−${fmtINR(r.out)}`} · balance ${fmtINR(r.balance)}`} />
            ))}
            {!s.rows.length && <ListRow title="Nothing received or paid out in this period" />}
          </View>
          <Button testID="statement-share" label="Share Statement" icon="share-2" variant="secondary" full onPress={() =>
            Share.share({ message: [`Statement of accounts ${s.from} to ${s.to}`, `Billed ${fmtINR(s.billed)} · Received ${fmtINR(s.received)} · Paid out ${fmtINR(s.paid_out)} · Net ${fmtINR(s.net)}`,
              ...s.rows.map((r) => `${r.date} ${r.kind} ${r.party} ${r.in ? `+${r.in}` : `-${r.out}`} = ${r.balance}`)].join('\n') }).catch(() => undefined)} />
        </>
      ))}
    </Screen>
  )
}
