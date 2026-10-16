import { Button, Chip, ConfirmSheet, EmptyState, Row, Screen, Segmented, SkeletonList, StatTile, TextField, TileGrid, ErrorState, space, useSession, useToast } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { useAppointments, useCancel } from '@/clinic/hooks'
import type { ClinicAppointment, Kind, Scope } from '@/clinic/types'
import { AppointmentCard } from '@/components/clinic/AppointmentCard'
import { CancelSheet } from '@/components/clinic/CancelSheet'
import { useRefresh } from '@/hooks/useRefresh'
import { can } from '@/lib/access'
import { useRouter } from '@/nav'
import type { StaffSession } from '@/types'

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Previous' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'drafts', label: 'Drafts' },
]

/**
 * "My Appointments" (dentor.fig 7970:4256 dashboard, 7970:4322 in-house, 7970:3530 / 3817 / 3935 lists,
 * 3188:1068 drafts): in-house and Dentor (visiting consultant) appointments, by day state, with search.
 */
export default function AppointmentsScreen() {
  const router = useRouter()
  const toast = useToast()
  const role = useSession<StaffSession>().data?.user?.role
  const canChange = can(role, 'front-desk')
  const [kind, setKind] = useState<Kind>('in-house')
  const [scope, setScope] = useState<Scope>('today')
  const [q, setQ] = useState('')
  const [cancelling, setCancelling] = useState<ClinicAppointment | null>(null)
  const list = useAppointments(scope, kind, q.trim())
  const cancel = useCancel()
  const { refreshing, refresh } = useRefresh(list)

  const counts = list.data?.counts
  const removeDraft = (a: ClinicAppointment) =>
    cancel.mutate({ id: a.id, reason: 'Draft deleted' }, { onSuccess: () => toast.success('Draft deleted.'), onError: (e) => toast.error(e) })

  return (
    <Screen
      testID="appointments-screen"
      title="My Appointments"
      back
      refreshing={refreshing}
      onRefresh={refresh}
      footer={canChange ? <Button testID="new-appointment" label="New Appointment" icon="plus" size="lg" full onPress={() => router.push('/appointments/new')} /> : undefined}
    >
      <Segmented options={[{ key: 'in-house', label: 'In-house' }, { key: 'consultant', label: 'Dentor' }]} value={kind} onChange={setKind} />
      <TileGrid>
        <StatTile testID="count-today" label="Today" value={counts?.today ?? '–'} icon="calendar" onPress={() => setScope('today')} />
        <StatTile testID="count-upcoming" label="Upcoming" value={counts?.upcoming ?? '–'} icon="clock" tone="blue" onPress={() => setScope('upcoming')} />
        <StatTile testID="count-drafts" label="Drafts" value={counts?.drafts ?? '–'} icon="edit-3" tone="amber" onPress={() => setScope('drafts')} />
        <StatTile testID="open-month" label="Monthly" value="View" icon="grid" tone="green" onPress={() => router.push('/appointments/month')} />
      </TileGrid>
      <TextField testID="appointment-search" icon="search" value={q} onChangeText={setQ} placeholder="Search patients, treatments, doctors…" autoCapitalize="none" />
      <Row wrap gap={space.sm}>
        {SCOPES.map((s) => (
          <Chip key={s.key} testID={`scope-${s.key}`} label={s.label} selected={scope === s.key} onPress={() => setScope(s.key)} />
        ))}
      </Row>
      {list.isLoading ? (
        <SkeletonList />
      ) : list.isError || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          testID="appointments-empty"
          icon="calendar"
          title={q ? 'Nothing matches the search' : scope === 'drafts' ? 'No drafts' : 'No appointments here'}
          message={scope === 'today' ? 'Nothing is booked for today in this list.' : undefined}
          action={canChange && scope !== 'cancelled' ? 'New Appointment' : undefined}
          onAction={() => router.push('/appointments/new')}
        />
      ) : (
        <View testID="appointment-list" style={{ gap: space.md }}>
          {list.data.items.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              showDate={scope !== 'today'}
              onPress={() => router.push({ pathname: '/appointments/[id]', params: { id: a.id } })}
              onReschedule={canChange ? () => router.push({ pathname: '/appointments/reschedule/[id]', params: { id: a.id } }) : undefined}
              onCancel={canChange ? () => (a.status === 'Draft' ? removeDraft(a) : setCancelling(a)) : undefined}
            />
          ))}
        </View>
      )}
      <CancelSheet appointment={cancelling} onClose={() => setCancelling(null)} />
    </Screen>
  )
}
