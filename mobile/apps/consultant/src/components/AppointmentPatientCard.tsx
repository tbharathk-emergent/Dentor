import { Avatar, Button, Card, colors, fmtDate, KeyValue, space, T } from '@dentor/shared'
import { View } from 'react-native'
import { ageGender, dotJoin } from '@/lib/people'
import type { PatientSummary } from '@/types'
import { AllergyBanner } from './AllergyBanner'

/** The patient behind an appointment: who they are, what to watch for, and a way into their record. */
export function AppointmentPatientCard({
  patient,
  fallbackName,
  onOpen,
}: {
  patient: PatientSummary | null
  /** Name on the appointment, for the rare booking that is not linked to a patient record. */
  fallbackName: string
  onOpen: (patientId: string) => void
}) {
  if (!patient) {
    return (
      <Card testID="appointment-no-patient" style={{ gap: space.xs }}>
        <T variant="bodyStrong">{fallbackName || 'Patient'}</T>
        <T variant="small" color={colors.textMuted}>This appointment is not linked to a patient record, so there is no history to show.</T>
      </Card>
    )
  }
  return (
    <Card testID="appointment-patient" style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar name={patient.name} uri={patient.photo || undefined} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="h3" numberOfLines={2} testID="appointment-patient-name">{patient.name}</T>
          <T variant="small" color={colors.textMuted} numberOfLines={1}>{dotJoin(patient.code, ageGender(patient))}</T>
        </View>
      </View>
      <AllergyBanner allergy={patient.allergy} />
      <View style={{ gap: 2 }}>
        <T variant="tiny" color={colors.textMuted}>MEDICAL HISTORY</T>
        <T variant="small" testID="appointment-history">{patient.history?.trim() || 'None recorded.'}</T>
      </View>
      <View>
        <KeyValue label="Blood group" value={patient.blood} />
        <KeyValue label="Mobile" value={patient.mobile} />
        <KeyValue label="Current treatment" value={patient.treatment} />
        <KeyValue label="Last visit" value={patient.lastVisit ? fmtDate(patient.lastVisit) : ''} />
      </View>
      <Button testID="open-patient" label="Open patient" icon="user" variant="secondary" full onPress={() => onOpen(patient.id)} />
    </Card>
  )
}
