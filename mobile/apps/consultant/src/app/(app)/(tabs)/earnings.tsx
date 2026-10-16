import { BarList, Card, EmptyState, fmtINR, QueryState, Screen, Section, StatTile, TileGrid, todayISO } from '@dentor/shared'
import { useState } from 'react'
import { ChipGroup } from '@/components/ChipGroup'
import { InvoiceRow } from '@/components/InvoiceRow'
import { ListCard } from '@/components/ListCard'
import { VisitEarnings } from '@/components/VisitEarnings'
import { useRouter } from '@/nav'
import { useEarnings } from '@/hooks/useEarnings'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus'
import { rangeLabel } from '@/lib/dates'
import { periodRange, PERIODS, type PeriodKey } from '@/lib/periods'

export default function EarningsScreen() {
  const router = useRouter()
  const [period, setPeriod] = useState<PeriodKey>('this_month')
  const { from, to } = periodRange(period, todayISO())
  const earnings = useEarnings(from, to)
  useRefetchOnFocus(earnings.refetch)
  const pull = usePullToRefresh(earnings.refetch)

  return (
    <Screen
      testID="screen-earnings"
      title="Earnings"
      subtitle={rangeLabel(from, to)}
      {...pull}
    >
      <ChipGroup testID="period" options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} value={period} onChange={setPeriod} />
      <QueryState query={earnings}>
        {(data) => (
          <>
            <TileGrid>
              <StatTile testID="earn-billed" label="Billed" value={fmtINR(data.billed)} hint={`${data.invoices} invoice${data.invoices === 1 ? '' : 's'}`} icon="file-text" />
              <StatTile testID="earn-collected" label="Collected" value={fmtINR(data.collected)} icon="check-circle" tone="green" />
              <StatTile testID="earn-outstanding" label="Outstanding" value={fmtINR(data.outstanding)} icon="clock" tone="red" />
              <StatTile testID="earn-visits" label="Completed visits" value={data.completed_visits} icon="user-check" tone="blue" />
            </TileGrid>

            <VisitEarnings onOpen={(id) => router.push({ pathname: '/requests/[id]', params: { id } })} />

            <Section title="By treatment">
              {data.by_treatment.length === 0 ? (
                <EmptyState testID="by-treatment-empty" icon="bar-chart-2" title="Nothing billed in this period" message="Invoices raised in your name are grouped by treatment here." />
              ) : (
                <Card testID="by-treatment">
                  <BarList rows={data.by_treatment.map((t) => ({ label: t.treatment, value: t.amount }))} format={fmtINR} />
                </Card>
              )}
            </Section>

            <Section title="Invoices">
              {data.items.length === 0 ? (
                <EmptyState testID="invoices-empty" icon="file-text" title="No invoices in this period" message="Try a longer period." />
              ) : (
                <ListCard testID="invoice-list">
                  {data.items.map((inv) => (
                    <InvoiceRow key={inv.id} invoice={inv} />
                  ))}
                </ListCard>
              )}
            </Section>
          </>
        )}
      </QueryState>
    </Screen>
  )
}
