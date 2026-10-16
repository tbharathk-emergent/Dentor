import { api, Button, EmptyState, ErrorState, ListRow, Screen, Section, SkeletonList, StatTile, T, TextField, TileGrid, colors, space, timeAgo, useSession, useToast } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Linking } from 'react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { usePatients } from '@/clinic/hooks'
import { useRefresh } from '@/hooks/useRefresh'
import { can } from '@/lib/access'
import { useRouter } from '@/nav'
import type { StaffSession } from '@/types'

/** "PATIENTS" (dentor.fig 7977:3719, 7977:3136): the figures, search and the list; "Add patient" for the front desk. */
export default function PatientsScreen() {
  const router = useRouter()
  const role = useSession<StaffSession>().data?.user?.role
  const [q, setQ] = useState('')
  const list = usePatients(q.trim())
  const { refreshing, refresh } = useRefresh(list)
  const f = list.data?.figures
  const toast = useToast()
  const queryClient = useQueryClient()
  // patients who asked for a call from the patient app ("Request Callback")
  const calls = useQuery<{ items: { id: string; patient: string; patient_code: string; mobile: string; when: string; note: string; created_at: string }[] }>({
    queryKey: ['clinic-app', 'callbacks'], queryFn: () => api.get('/api/clinic-app/callbacks'),
  })
  const called = useMutation({ mutationFn: (id: string) => api.post(`/api/clinic-app/callbacks/${id}/done`) })

  return (
    <Screen
      testID="patients-screen"
      title="Patients"
      back
      refreshing={refreshing}
      onRefresh={refresh}
      footer={can(role, 'front-desk') ? <Button testID="add-patient" label="Add patient" icon="user-plus" size="lg" full onPress={() => router.push('/patients/new')} /> : undefined}
    >
      <TileGrid>
        <StatTile testID="patients-total" label="Total patients" value={f?.total ?? '–'} icon="users" />
        <StatTile testID="patients-new" label="New this month" value={f?.new_this_month ?? '–'} icon="user-plus" tone="green" />
        <StatTile testID="patients-today" label="Seen today" value={f?.seen_today ?? '–'} icon="check-circle" tone="blue" />
        <StatTile label="Appointments" value="Open" icon="calendar" tone="amber" onPress={() => router.push('/appointments')} />
      </TileGrid>
      {!!calls.data?.items.length && (
        <Section title={`Callback requests (${calls.data.items.length})`}>
          {calls.data.items.map((c) => (
            <ListRow key={c.id} testID={`callback-${c.patient_code}`} title={`${c.patient} · ${c.mobile}`} subtitle={[c.when, c.note].filter(Boolean).join(' · ')} meta={timeAgo(c.created_at)}
              right={can(role, 'front-desk') ? <T variant="smallStrong" color={colors.title}>Mark called</T> : undefined}
              onPress={() => (can(role, 'front-desk') ? called.mutate(c.id, { onSuccess: () => { toast.success('Marked as called.'); void queryClient.invalidateQueries({ queryKey: ['clinic-app', 'callbacks'] }) }, onError: (e) => toast.error(e) })
                : Linking.openURL(`tel:${c.mobile}`).catch(() => undefined))} />
          ))}
        </Section>
      )}
      <TextField testID="patients-search" icon="search" value={q} onChangeText={setQ} placeholder="Search by name, patient ID or mobile" autoCapitalize="none" />
      {list.isLoading ? <SkeletonList /> : list.isError || !list.data ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data.items.length ? (
        <View testID="patient-list" style={{ gap: space.xs }}>
          {list.data.items.map((p) => (
            <ListRow
              key={p.id}
              testID={`patient-${p.code}`}
              title={p.name}
              subtitle={[p.code, p.mobile, [p.gender, p.age ? `${p.age} yrs` : ''].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
              meta={p.last_visit_label ? `Last visit ${p.last_visit_label}` : 'No visit yet'}
              chevron
              onPress={() => router.push({ pathname: '/patients/[id]', params: { id: p.id } })}
            />
          ))}
        </View>
      ) : (
        <EmptyState testID="patients-empty" icon="users" title={q ? 'No patient matches' : 'No patients yet'} action={can(role, 'front-desk') ? 'Add patient' : undefined} onAction={() => router.push('/patients/new')} />
      )}
    </Screen>
  )
}
