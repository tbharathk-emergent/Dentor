import { EmptyState, ErrorState, ListRow, Screen, Segmented, SkeletonList, StatusBadge, space } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useRequests, type RequestScope } from '@/hooks/useRequests'
import { useRouter } from '@/nav'

/**
 * Requests from clinics (dentor.fig "Pending appointments" 6992:4101, "Upcoming appointments" 6907:5456,
 * "previous appointments" 5142:5289): new requests to confirm, confirmed visits, and the past.
 */
export default function RequestsScreen() {
  const router = useRouter()
  const [scope, setScope] = useState<RequestScope>('pending')
  const list = useRequests(scope)
  const pull = usePullToRefresh(list.refetch)
  const counts = list.data?.counts

  return (
    <Screen testID="requests-screen" title="Clinic Requests" back {...pull}>
      <Segmented
        options={[
          { key: 'pending', label: `Pending${counts ? ` (${counts.pending})` : ''}` },
          { key: 'upcoming', label: `Upcoming${counts ? ` (${counts.upcoming})` : ''}` },
          { key: 'previous', label: 'Previous' },
        ]}
        value={scope}
        onChange={setScope}
      />
      {list.isLoading ? <SkeletonList /> : list.isError || !list.data ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data.items.length ? (
        <View testID="request-list" style={{ gap: space.xs }}>
          {list.data.items.map((b) => (
            <ListRow
              key={b.id}
              testID={`request-${b.id}`}
              title={`${b.patient} · ${b.treatment}`}
              subtitle={[b.date ? `${b.date_label} ${b.time_label}` : b.dentor_type_label || 'Choose a time', b.choice === 'dentor' && !b.consultant ? 'Open request' : ''].filter(Boolean).join(' · ')}
              meta={b.code}
              right={<StatusBadge status={b.status} />}
              chevron
              onPress={() => router.push({ pathname: '/requests/[id]', params: { id: b.id } })}
            />
          ))}
        </View>
      ) : (
        <EmptyState testID="requests-empty" icon="inbox" title={scope === 'pending' ? 'No new requests' : scope === 'upcoming' ? 'Nothing confirmed yet' : 'Nothing in the past yet'} message={scope === 'pending' ? 'Clinics that book you appear here for you to confirm.' : undefined} />
      )}
    </Screen>
  )
}
