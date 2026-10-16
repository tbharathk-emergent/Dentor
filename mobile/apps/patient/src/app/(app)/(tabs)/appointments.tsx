import { EmptyState, QueryState, Screen } from '@dentor/shared'
import { useState } from 'react'
import { PatientHeader } from '@/components/PatientHeader'
import { SplitTabs } from '@/components/SplitTabs'
import { Rows } from '@/components/Rows'
import { AppointmentCard } from '@/components/appointments/AppointmentCard'
import { useAppointments } from '@/hooks/useAppointments'
import { useRefresh } from '@/hooks/useRefresh'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'
import { useRouter } from '@/nav'
import type { AppointmentScope } from '@/types'

const SCOPES: { key: AppointmentScope; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Previous' },
]

export default function Appointments() {
  const router = useRouter()
  const [scope, setScope] = useState<AppointmentScope>('upcoming')
  const list = useAppointments(scope)
  const { refreshing, onRefresh } = useRefresh(list.refetch)
  useRefreshOnFocus(list.refetch)

  return (
    <Screen testID="appointments-screen" header={<PatientHeader />} refreshing={refreshing} onRefresh={onRefresh}>
      <SplitTabs options={SCOPES} value={scope} onChange={setScope} />
      <QueryState query={list}>
        {(data) =>
          data.items.length === 0 ? (
            scope === 'upcoming' ? (
              <EmptyState
                testID="appointments-empty"
                title="No upcoming visits"
                message="Book a visit with your dentist in a few taps."
                action="Book an appointment"
                onAction={() => router.push('/book')}
              />
            ) : (
              <EmptyState testID="appointments-empty" icon="clock" title="No previous visits yet" message="Visits you have completed or cancelled appear here." />
            )
          ) : (
            <Rows testID={`appointments-${scope}`}>
              {data.items.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  testID={`appointment-card-${appointment.id}`}
                  appointment={appointment}
                  onPress={() => router.push({ pathname: '/appointment/[id]', params: { id: appointment.id } })}
                />
              ))}
            </Rows>
          )
        }
      </QueryState>
    </Screen>
  )
}
