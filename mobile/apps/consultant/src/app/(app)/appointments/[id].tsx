import { Banner, Card, colors, Divider, KeyValue, QueryState, Screen, space, StatusBadge, T } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { AppointmentActions } from '@/components/AppointmentActions'
import { AppointmentPatientCard } from '@/components/AppointmentPatientCard'
import { VisitNotesCard } from '@/components/VisitNotesCard'
import { useAppointment } from '@/hooks/useAppointments'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { isOpen } from '@/lib/appointments'
import { longDate } from '@/lib/dates'
import { useLocalSearchParams, useRouter } from '@/nav'

export default function AppointmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const query = useAppointment(id)
  const pull = usePullToRefresh(query.refetch)
  const a = query.data

  // null = untouched: show what is saved. A string = the consultant's unsaved edit.
  const [draft, setDraft] = useState<string | null>(null)
  const saved = a?.notes ?? ''
  const notes = draft ?? saved
  const dirty = draft !== null && draft.trim() !== saved

  return (
    <Screen
      testID="screen-appointment"
      title="Appointment"
      subtitle={a?.code}
      back
      {...pull}
      footer={a && isOpen(a.status) ? <AppointmentActions appointment={a} notes={dirty ? notes : undefined} full testID="appointment" /> : undefined}
    >
      <QueryState query={query}>
        {(appt) => (
          <>
            <Card style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T variant="h1" testID="appointment-time">{appt.time_label}</T>
                  <T variant="small" color={colors.textMuted}>{longDate(appt.date)}</T>
                </View>
                <View testID="appointment-status">
                  <StatusBadge status={appt.status} />
                </View>
              </View>
              <T variant="h3" testID="appointment-treatment">{appt.treatment || 'Appointment'}</T>
              <Divider />
              <View>
                <KeyValue label="Chair" value={appt.chair} />
                <KeyValue label="Duration" value={appt.duration} />
                <KeyValue label="Reference" value={appt.code} />
              </View>
            </Card>

            {!isOpen(appt.status) && (
              <Banner
                tone={appt.status === 'Cancelled' ? 'red' : 'green'}
                icon={appt.status === 'Cancelled' ? 'x-circle' : 'check-circle'}
                text={`This appointment is ${appt.status.toLowerCase()}. Its status can no longer be changed in the app; the notes can still be edited.`}
              />
            )}

            <AppointmentPatientCard
              patient={appt.patient_record}
              fallbackName={appt.patient}
              onOpen={(patientId) => router.push({ pathname: '/patients/[id]', params: { id: patientId } })}
            />

            <VisitNotesCard appointment={appt} value={notes} dirty={dirty} onChange={setDraft} onSaved={(saved) => setDraft((current) => (current === saved ? null : current))} />
          </>
        )}
      </QueryState>
    </Screen>
  )
}
