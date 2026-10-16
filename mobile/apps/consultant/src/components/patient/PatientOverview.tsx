import { Card, colors, EmptyState, fmtDate, KeyValue, ListRow, Section, space, StatusBadge, T } from '@dentor/shared'
import { View } from 'react-native'
import { ListCard } from '@/components/ListCard'
import { ageInYears, dotJoin } from '@/lib/people'
import type { PatientDetail } from '@/types'

/** Demographics, medical history, consents and the visits this patient has had with me. */
export function PatientOverview({ detail, onOpenAppointment }: { detail: PatientDetail; onOpenAppointment: (id: string) => void }) {
  const p = detail.patient
  return (
    <View style={{ gap: space.lg }}>
      <Card>
        <KeyValue label="Age" value={ageInYears(p.age)} />
        <KeyValue label="Gender" value={p.gender} />
        <KeyValue label="Blood group" value={p.blood} />
        <KeyValue label="Mobile" value={p.mobile} />
        <KeyValue label="Current treatment" value={p.treatment} />
        <KeyValue label="Last visit" value={p.lastVisit ? fmtDate(p.lastVisit) : ''} />
      </Card>

      <Section title="Medical history">
        <Card>
          <T variant="body" testID="patient-history" color={p.history?.trim() ? colors.text : colors.textMuted}>
            {p.history?.trim() || 'None recorded.'}
          </T>
        </Card>
      </Section>

      <Section title="Consents">
        {detail.consents.length === 0 ? (
          <Card testID="consents-empty">
            <T variant="small" color={colors.textMuted}>No consent form on record. The clinic may need a signed consent before a treatment can be added.</T>
          </Card>
        ) : (
          <ListCard testID="consent-list">
            {detail.consents.map((c) => (
              <ListRow key={c.id} title={c.title} subtitle={dotJoin(c.date && fmtDate(c.date), c.notes)} right={<StatusBadge status={c.status} />} />
            ))}
          </ListCard>
        )}
      </Section>

      <Section title="Recent appointments with me">
        {detail.appointments.length === 0 ? (
          <EmptyState testID="patient-appointments-empty" icon="calendar" title="No appointments with you" message="This patient was referred to you but has not been booked in yet." />
        ) : (
          <ListCard testID="patient-appointments">
            {detail.appointments.map((a) => (
              <ListRow
                key={a.id}
                testID={`patient-appt-${a.id}`}
                title={a.treatment || 'Appointment'}
                subtitle={dotJoin(a.date_label, a.time_label)}
                meta={a.chair || undefined}
                right={<StatusBadge status={a.status} />}
                onPress={() => onOpenAppointment(a.id)}
                chevron
              />
            ))}
          </ListCard>
        )}
      </Section>
    </View>
  )
}
