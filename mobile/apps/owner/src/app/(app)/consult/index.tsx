import { Button, EmptyState, ErrorState, ListRow, Screen, Segmented, SkeletonList, StatusBadge, space, useSession, stripeColors } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { useConsultRequests } from '@/clinic/consult'
import { useRefresh } from '@/hooks/useRefresh'
import { can } from '@/lib/access'
import { useRouter } from '@/nav'
import type { StaffSession } from '@/types'

/** The clinic's consultant bookings: requests waiting for an answer and confirmed visits, then the past ones. */
export default function ConsultHome() {
  const router = useRouter()
  const role = useSession<StaffSession>().data?.user?.role
  const [scope, setScope] = useState<'active' | 'past'>('active')
  const list = useConsultRequests(scope)
  const { refreshing, refresh } = useRefresh(list)

  return (
    <Screen
      testID="consult-screen"
      title="Consultant Bookings"
      back
      refreshing={refreshing}
      onRefresh={refresh}
      footer={can(role, 'front-desk') ? <Button testID="consult-book" label="Book a Consultant" icon="plus" size="lg" full onPress={() => router.push('/consult/book')} /> : undefined}
    >
      <Segmented options={[{ key: 'active', label: 'Active' }, { key: 'past', label: 'Past' }]} value={scope} onChange={setScope} />
      {list.isLoading ? <SkeletonList /> : list.isError || !list.data ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data.items.length ? (
        <View testID="consult-list" style={{ gap: space.md }}>
          {list.data.items.map((b) => (
            <ListRow
              key={b.id}
              stripe={stripeColors.attention}
              testID={`consult-${b.id}`}
              title={`${b.patient} · ${b.treatment}`}
              subtitle={[b.consultant || (b.dentor_type_label ? `Dentor choice · ${b.dentor_type_label}` : 'Dentor choice'), b.date ? `${b.date_label} ${b.time_label}` : 'Time to be set'].join(' · ')}
              meta={b.code}
              right={<StatusBadge status={b.status} />}
              chevron
              onPress={() => router.push({ pathname: '/consult/[id]', params: { id: b.id } })}
            />
          ))}
        </View>
      ) : (
        <EmptyState testID="consult-empty" icon="user-check" title={scope === 'active' ? 'No consultant bookings' : 'Nothing in the past yet'} message="Book a visiting consultant for a patient's specialist treatment." />
      )}
    </Screen>
  )
}
