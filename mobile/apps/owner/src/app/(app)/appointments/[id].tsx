import { Badge, Banner, Button, Card, KeyValue, ListRow, QueryState, Screen, Section, StatusBadge, T, colors, fmtDate, space, todayISO, useLocalSearchParams, useToast } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { useAppointment, useSetStatus } from '@/clinic/hooks'
import { CancelSheet } from '@/components/clinic/CancelSheet'
import { useRefresh } from '@/hooks/useRefresh'
import { useRouter } from '@/nav'

/**
 * An appointment and its "Case summary" (dentor.fig 7970:4013): the patient, history and allergies,
 * the treatment plan, recent prescriptions and visits; check-in, complete, reschedule, swap or cancel.
 */
export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const appointment = useAppointment(id)
  const setStatus = useSetStatus()
  const [cancelling, setCancelling] = useState(false)
  const { refreshing, refresh } = useRefresh(appointment)

  const move = (status: 'Waiting' | 'Completed') =>
    setStatus.mutate({ id, status }, { onSuccess: () => toast.success(status === 'Waiting' ? 'Checked in.' : 'Marked completed.'), onError: (e) => toast.error(e) })

  return (
    <Screen testID="appointment-screen" title="Appointment" back refreshing={refreshing} onRefresh={refresh}>
      <QueryState query={appointment}>
        {(a) => {
          const p = a.patient_record
          const live = a.can_change && a.changeable
          return (
            <>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                  <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>{a.patient}</T>
                  <StatusBadge status={a.status} />
                </View>
                <KeyValue label="When" value={a.status === 'Draft' && !a.time ? 'Not booked yet (draft)' : `${a.date_label} · ${a.time_label}`} />
                <KeyValue label="Treatment" value={a.treatment} />
                <KeyValue label="Doctor" value={a.doctor} />
                <KeyValue label="Chair" value={a.chair} />
                <KeyValue label="Booked by" value={a.source} />
                <KeyValue label="Appointment ID" value={a.code} />
                {!!a.rescheduled_from && <KeyValue label="Original date" value={`${a.rescheduled_from.date_label} · ${a.rescheduled_from.time_label}`} />}
                {!!a.reschedule_reason && <KeyValue label="Reschedule reason" value={a.reschedule_reason} />}
                {!!a.cancel_reason && <KeyValue label="Cancel reason" value={a.cancel_reason} />}
                {!!a.refund_note && <KeyValue label="Refund note" value={a.refund_note} />}
                <Badge label={a.kind === 'consultant' ? 'DENTOR' : 'IN-HOUSE'} tone={a.kind === 'consultant' ? 'violet' : 'slate'} />
              </Card>

              {live && (
                <View style={{ gap: space.sm }}>
                  {a.status === 'Scheduled' && a.date === todayISO() && (
                    <Button testID="check-in" label="Check in" icon="log-in" full loading={setStatus.isPending} onPress={() => move('Waiting')} />
                  )}
                  {a.status === 'Waiting' && <Button testID="complete" label="Mark completed" icon="check" full loading={setStatus.isPending} onPress={() => move('Completed')} />}
                  <Button testID="detail-reschedule" label={a.status === 'Draft' ? 'Book a time' : 'Reschedule'} icon="calendar" variant="secondary" full
                    onPress={() => router.push({ pathname: '/appointments/reschedule/[id]', params: { id: a.id } })} />
                  {a.status !== 'Draft' && (
                    <Button testID="detail-swap" label="Time swap" icon="repeat" variant="outline" full onPress={() => router.push({ pathname: '/appointments/swap/[id]', params: { id: a.id } })} />
                  )}
                  <Button testID="detail-cancel" label={a.status === 'Draft' ? 'Delete draft' : 'Cancel appointment'} icon="x" variant="ghost" full onPress={() => setCancelling(true)} />
                </View>
              )}

              <Section title="Case summary">
                {p ? (
                  <Card>
                    <KeyValue label="Patient ID" value={p.code} />
                    <KeyValue label="Age, gender" value={[p.age ? `${p.age} yrs` : '', p.gender].filter(Boolean).join(', ')} />
                    <KeyValue label="Mobile" value={p.mobile} />
                    <KeyValue label="Blood group" value={p.blood} />
                    <KeyValue label="History" value={p.history || 'None recorded'} />
                    {!!p.allergy && <Banner tone="red" icon="alert-triangle" text={`Allergy: ${p.allergy}`} />}
                    <Button testID="open-patient" label="Open patient" variant="ghost" full onPress={() => router.push({ pathname: '/patients/[id]', params: { id: p.id } })} />
                  </Card>
                ) : (
                  <T variant="small" color={colors.textMuted}>No patient record is linked to this appointment.</T>
                )}
              </Section>
              {a.treatments.length > 0 && (
                <Section title="Treatment plan">
                  {a.treatments.map((t, i) => <ListRow key={i} title={t.name} subtitle={[t.tooth && `Tooth ${t.tooth}`, fmtDate(t.date)].filter(Boolean).join(' · ')} right={<StatusBadge status={t.status} />} />)}
                </Section>
              )}
              {a.prescriptions.length > 0 && (
                <Section title="E-prescriptions">
                  {a.prescriptions.map((rx) => <ListRow key={rx.code} title={rx.diagnosis || rx.code} subtitle={`${rx.code} · ${fmtDate(rx.date)} · ${rx.doctor}`} />)}
                </Section>
              )}
              {a.visits.length > 0 && (
                <Section title="Previous visits">
                  {a.visits.map((v, i) => <ListRow key={i} title={v.treatment} subtitle={fmtDate(v.date)} right={<StatusBadge status={v.status} />} />)}
                </Section>
              )}
              <CancelSheet
                appointment={cancelling ? a : null}
                onClose={() => setCancelling(false)}
                onDone={() => (a.status === 'Draft' ? router.back() : undefined)}
              />
            </>
          )
        }}
      </QueryState>
    </Screen>
  )
}
