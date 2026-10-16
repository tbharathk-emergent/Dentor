import { ErrorState, ListRow, Screen, Section, Segmented, SkeletonList, StatTile, StatusBadge, TileGrid, fmtINR, space } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { useAccountsSummary, useDentorAccounts } from '@/clinic/accounts'
import { PeriodControl } from '@/components/PeriodControl'
import { usePeriod } from '@/hooks/usePeriod'
import { useRefresh } from '@/hooks/useRefresh'
import { useRouter } from '@/nav'

const change = (pct: number | null) => (pct === null ? undefined : `${pct >= 0 ? '+' : ''}${pct}% on the period before`)
const ICONS = { Consultant: 'user-check', 'Duty Doctors': 'users', Purchase: 'shopping-cart', 'Lab Orders': 'droplet', Miscellaneous: 'more-horizontal', Staff: 'briefcase', Domestic: 'home' } as const

/**
 * "Accounts Dashboard" (dentor.fig 194–197, 203, 253–256): in-house accounts — revenue, expenses by category,
 * invoices, receipts and the statement — and Dentor accounts — consultant visits by fee status.
 */
export default function AccountsHome() {
  const router = useRouter()
  const period = usePeriod()
  const [side, setSide] = useState<'in-house' | 'dentor'>('in-house')
  const [dentor, setDentor] = useState<'completed' | 'pending' | 'cancelled'>('completed')
  const summary = useAccountsSummary(period.range)
  const visits = useDentorAccounts(dentor, period.range)
  const { refreshing, refresh } = useRefresh(summary, visits)
  const s = summary.data

  return (
    <Screen testID="accounts-screen" title="Accounts" back refreshing={refreshing} onRefresh={refresh}>
      <Segmented options={[{ key: 'in-house', label: 'In-house Accounts' }, { key: 'dentor', label: 'Dentor Accounts' }]} value={side} onChange={setSide} />
      <PeriodControl scope="accounts" updating={summary.isPlaceholderData} />
      {summary.isLoading ? <SkeletonList rows={2} /> : summary.isError || !s ? <ErrorState error={summary.error} onRetry={() => summary.refetch()} /> : side === 'in-house' ? (
        <>
          <TileGrid>
            <StatTile testID="accounts-revenue" label="Total Revenue" value={fmtINR(s.collected)} hint={change(s.collected_change) ?? `Billed ${fmtINR(s.billed)}`} icon="trending-up" tone="green" />
            <StatTile testID="accounts-expenses" label="Total Expenses" value={fmtINR(s.expenses)} hint={change(s.expenses_change)} icon="trending-down" tone="red" onPress={() => router.push('/accounts/expenses')} />
          </TileGrid>
          <TileGrid>
            <StatTile testID="accounts-invoices" label="Invoices" value="Open" icon="file-text" onPress={() => router.push('/accounts/invoices')} />
            <StatTile testID="accounts-receipts" label="Receipts" value="Open" icon="check-square" tone="green" onPress={() => router.push({ pathname: '/accounts/invoices', params: { tab: 'receipts' } })} />
            <StatTile testID="accounts-statement" label="Statement of Accounts" value="Open" icon="list" tone="blue" onPress={() => router.push('/accounts/statement')} />
            <StatTile testID="accounts-net" label="Net" value={fmtINR(s.net)} icon="activity" tone={s.net >= 0 ? 'green' : 'red'} />
          </TileGrid>
          <Section title="Expenses" action="Add expense" onAction={() => router.push('/accounts/expenses')}>
            <TileGrid>
              {s.categories.map((c) => (
                <StatTile key={c.category} testID={`expense-cat-${c.category}`} label={c.category} value={fmtINR(c.amount)} hint={`${c.entries} entr${c.entries === 1 ? 'y' : 'ies'}`}
                  icon={ICONS[c.category]} tone="slate" onPress={() => router.push({ pathname: '/accounts/expenses', params: { category: c.category } })} />
              ))}
            </TileGrid>
          </Section>
        </>
      ) : (
        <>
          <TileGrid>
            <StatTile testID="dentor-completed" label="Completed" value={fmtINR(s.dentor.completed)} icon="check-circle" tone="green" onPress={() => setDentor('completed')} />
            <StatTile testID="dentor-pending" label="Outstanding" value={fmtINR(s.dentor.pending)} icon="clock" tone="amber" onPress={() => setDentor('pending')} />
            <StatTile testID="dentor-cancelled" label="Cancelled" value={fmtINR(s.dentor.cancelled)} hint="No charge" icon="x-circle" tone="slate" onPress={() => setDentor('cancelled')} />
          </TileGrid>
          <Segmented options={[{ key: 'completed', label: 'Completed' }, { key: 'pending', label: 'Pending' }, { key: 'cancelled', label: 'Cancelled' }]} value={dentor} onChange={setDentor} />
          {visits.isLoading ? <SkeletonList rows={2} /> : visits.isError ? <ErrorState error={visits.error} onRetry={() => visits.refetch()} /> : (
            <View style={{ gap: space.xs }}>
              {visits.data?.items.map((b) => (
                <ListRow key={b.id} testID={`dentor-${b.code}`} title={`${b.patient} · ${b.treatment}`} subtitle={`${b.consultant} · ${b.date_label || 'not booked yet'}`} meta={b.code}
                  right={<StatusBadge status={b.status} />} onPress={() => router.push({ pathname: '/consult/[id]', params: { id: b.id } })} />
              ))}
              {!visits.data?.items.length && <ListRow title="No consultant visits in this period" />}
            </View>
          )}
        </>
      )}
    </Screen>
  )
}
