import { api, Chip, EmptyState, ErrorState, fmtINR, ListRow, Row, Section, SkeletonList, space, StatusBadge, StatTile, TileGrid } from '@dentor/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { View } from 'react-native'

type Group = 'all' | 'completed' | 'pending' | 'cancelled'
interface Visits {
  clinic: string
  totals: { completed: number; pending: number }
  items: { id: string; code: string; date_label: string; patient: string; treatment: string; fee: number; status: string; group: Group }[]
}

/** "Earnings history" (dentor.fig 414–417): visits clinics booked with me and their fees, by status. */
export function VisitEarnings({ onOpen }: { onOpen: (id: string) => void }) {
  const [group, setGroup] = useState<Group>('all')
  const visits = useQuery<Visits>({ queryKey: ['earning-visits', group], queryFn: () => api.get(`/api/consultant/earnings/visits?status=${group}`) })
  return (
    <Section title="Clinic visits">
      {visits.isLoading ? <SkeletonList rows={2} /> : visits.isError || !visits.data ? <ErrorState error={visits.error} onRetry={() => visits.refetch()} /> : (
        <>
          <TileGrid>
            <StatTile testID="visits-earned" label="Earned (completed)" value={fmtINR(visits.data.totals.completed)} icon="check-circle" tone="green" />
            <StatTile testID="visits-pending" label="Pending visits" value={fmtINR(visits.data.totals.pending)} icon="clock" tone="amber" />
          </TileGrid>
          <Row wrap gap={space.xs}>
            {(['all', 'completed', 'pending', 'cancelled'] as const).map((g) => (
              <Chip key={g} testID={`visits-${g}`} label={g === 'all' ? 'All' : g[0].toUpperCase() + g.slice(1)} selected={group === g} onPress={() => setGroup(g)} />
            ))}
          </Row>
          {visits.data.items.length ? (
            <View style={{ gap: space.xs }}>
              {visits.data.items.map((v) => (
                <ListRow key={v.id} testID={`visit-${v.code}`} title={`${v.patient} · ${fmtINR(v.fee)}`} subtitle={`${v.treatment} · ${visits.data.clinic}`} meta={v.date_label}
                  right={<StatusBadge status={v.status} />} onPress={() => onOpen(v.id)} />
              ))}
            </View>
          ) : <EmptyState icon="briefcase" title="No clinic visits here" message="Visits that clinics book through the Clinic app appear with their fee." />}
        </>
      )}
    </Section>
  )
}
