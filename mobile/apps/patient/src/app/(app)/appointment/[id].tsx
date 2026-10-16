import { Button, Card, KeyValue, ListRow, QueryState, Screen, Section, T, colors } from '@dentor/shared'
import { useState } from 'react'
import { AppointmentDetails } from '@/components/appointments/AppointmentDetails'
import { CancelSheet } from '@/components/appointments/CancelSheet'
import { RescheduleSheet } from '@/components/appointments/RescheduleSheet'
import { useAppointment } from '@/hooks/useAppointments'
import { useMe } from '@/hooks/useMe'
import { useRefresh } from '@/hooks/useRefresh'
import { useLocalSearchParams, useRouter } from '@/nav'

export default function AppointmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const appointment = useAppointment(id)
  const me = useMe()
  const { refreshing, onRefresh } = useRefresh(appointment.refetch)
  const [sheet, setSheet] = useState<'cancel' | 'reschedule' | null>(null)

  const data = appointment.data
  const actions =
    data && (data.can_reschedule || data.can_cancel) ? (
      <>
        {data.can_reschedule && (
          <Button testID="appointment-reschedule" label="Reschedule" icon="calendar" variant="secondary" full onPress={() => setSheet('reschedule')} />
        )}
        {data.can_cancel && (
          <Button testID="appointment-cancel" label="Cancel appointment" icon="x" variant="outline" full onPress={() => setSheet('cancel')} />
        )}
      </>
    ) : undefined

  return (
    <Screen testID="appointment-screen" title="Appointment" back footer={actions} refreshing={refreshing} onRefresh={onRefresh}>
      <QueryState query={appointment}>{(found) => <AppointmentDetails appointment={found} clinic={me.data?.clinic} />}</QueryState>
      {data?.case && <CaseSummary summary={data.case} />}
      {data && (
        <>
          <RescheduleSheet appointment={data} visible={sheet === 'reschedule'} onClose={() => setSheet(null)} />
          <CancelSheet appointment={data} visible={sheet === 'cancel'} onClose={() => setSheet(null)} />
        </>
      )}
    </Screen>
  )
}


function CaseSummary({ summary }: { summary: NonNullable<import('@/types').Appointment['case']> }) {
  const router = useRouter()
  const empty = !summary.diagnosis && !summary.procedure && !summary.medicines.length && !summary.files.length
  return (
    <Section title="Case summary">
      {empty ? (
        <T variant="small" color={colors.textMuted} testID="case-empty">The clinic has not added notes for this visit yet.</T>
      ) : (
        <Card testID="case-summary">
          <KeyValue label="Diagnosis" value={summary.diagnosis} />
          <KeyValue label="Procedure" value={summary.procedure} />
          <KeyValue label="Blood pressure" value={summary.vitals.bp ? `${summary.vitals.bp} mmHg` : ''} />
          <KeyValue label="Blood glucose" value={summary.vitals.glucose ? `${summary.vitals.glucose} mg/dL` : ''} />
          {summary.medicines.map((m, i) => <KeyValue key={i} label={i === 0 ? 'Medicines' : ''} value={m} />)}
          <KeyValue label="Advice" value={summary.advice} />
          <KeyValue label="Notes" value={summary.notes} />
        </Card>
      )}
      {summary.files.map((f) => <ListRow key={f.id} title={f.name} subtitle={f.category} chevron onPress={() => router.push({ pathname: '/reports/[id]', params: { id: f.id } })} />)}
    </Section>
  )
}
