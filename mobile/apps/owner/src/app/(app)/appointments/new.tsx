import { Banner, Button, Chip, ErrorState, ListRow, Row, Screen, Section, SkeletonList, T, TextField, addDays, colors, errorMessage, space, todayISO, useToast } from '@dentor/shared'
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { useBook, useDoctors, useSlots } from '@/clinic/hooks'
import type { PatientRow } from '@/clinic/types'
import { DateStrip } from '@/components/clinic/DateStrip'
import { PatientPicker } from '@/components/clinic/PatientPicker'
import { SlotGrid } from '@/components/clinic/SlotGrid'
import { useRouter } from '@/nav'

/**
 * "schedule appointment" (dentor.fig 7970:3530): patient, doctor, a day from the strip and a free slot.
 * "Save as draft" keeps the form without holding a slot (dentor.fig "draft" 3188:1068).
 */
export default function NewAppointment() {
  const router = useRouter()
  const toast = useToast()
  const doctors = useDoctors()
  const book = useBook()
  const dates = useMemo(() => Array.from({ length: 30 }, (_, i) => addDays(todayISO(), i)), [])
  const [patient, setPatient] = useState<PatientRow | null>(null)
  const [picking, setPicking] = useState(false)
  const [doctor, setDoctor] = useState('')
  const [date, setDate] = useState(dates[0])
  const [time, setTime] = useState('')
  const [treatment, setTreatment] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const slots = useSlots(date, doctor)

  const submit = (draft: boolean) => {
    const found = {
      patient: patient ? undefined : 'Choose the patient.',
      doctor: doctor ? undefined : 'Choose the doctor.',
      time: draft || time ? undefined : 'Choose a free time.',
    }
    setErrors(found)
    setFailure(null)
    if (Object.values(found).some(Boolean) || !patient) return
    book.mutate(
      { patient_id: patient.id, doctor, date: draft && !time ? '' : date, time: draft && !time ? '' : time, treatment: treatment.trim(), notes: notes.trim(), draft },
      {
        onSuccess: (a) => {
          toast.success(draft ? 'Saved as a draft. No slot is held until you book it.' : `Booked: ${a.patient}, ${a.date_label} at ${a.time_label}.`)
          router.replace({ pathname: '/appointments/[id]', params: { id: a.id } })
        },
        onError: (e) => {
          setFailure(errorMessage(e))
          void slots.refetch()
        },
      },
    )
  }

  return (
    <Screen
      testID="new-appointment-screen"
      title="New Appointment"
      back
      footer={
        <View style={{ gap: space.sm }}>
          <Button testID="book-submit" label="Book appointment" size="lg" full loading={book.isPending && !book.variables?.draft} onPress={() => submit(false)} />
          <Button testID="book-draft" label="Save as draft" variant="ghost" full loading={book.isPending && !!book.variables?.draft} onPress={() => submit(true)} />
        </View>
      }
    >
      <Section title="Patient">
        {patient ? (
          <ListRow testID="chosen-patient" title={patient.name} subtitle={`${patient.code} · ${patient.mobile}`} right={<T variant="smallStrong" color={colors.title}>Change</T>} onPress={() => setPicking(true)} />
        ) : (
          <Button testID="choose-patient" label="Choose a patient" icon="user" variant="secondary" full onPress={() => setPicking(true)} />
        )}
        {!!errors.patient && <T variant="small" color={colors.red}>{errors.patient}</T>}
      </Section>
      <Section title="Doctor">
        {doctors.isLoading ? <SkeletonList rows={1} /> : doctors.isError ? <ErrorState error={doctors.error} onRetry={() => doctors.refetch()} /> : (
          <Row wrap gap={space.sm}>
            {doctors.data?.items.map((d) => (
              <Chip key={d.id} testID={`doctor-${d.name}`} label={`${d.name}${d.kind === 'consultant' ? ' · Dentor' : ''}`} selected={doctor === d.name} onPress={() => { setDoctor(d.name); setTime('') }} />
            ))}
          </Row>
        )}
        {!!errors.doctor && <T variant="small" color={colors.red}>{errors.doctor}</T>}
      </Section>
      <Section title="Select Date">
        <DateStrip dates={dates} value={date} today={dates[0]} onChange={(d) => { setDate(d); setTime('') }} />
      </Section>
      <Section title="Time">
        {!doctor ? (
          <T variant="small" color={colors.textMuted}>Choose a doctor to see the free times.</T>
        ) : slots.isLoading ? <SkeletonList rows={2} /> : slots.isError ? <ErrorState error={slots.error} onRetry={() => slots.refetch()} /> : slots.data && slots.data.slots.some((s) => s.available) ? (
          <SlotGrid slots={slots.data.slots} value={time} onChange={setTime} />
        ) : (
          <Banner tone="amber" icon="calendar" text="No free time on this day. Choose another day." />
        )}
        {!!errors.time && <T variant="small" color={colors.red}>{errors.time}</T>}
      </Section>
      <TextField testID="book-treatment" label="Treatment" value={treatment} onChangeText={setTreatment} placeholder="e.g. RCT, Scaling" maxLength={120} />
      <TextField testID="book-notes" label="Notes" value={notes} onChangeText={setNotes} multiline maxLength={500} />
      {!!failure && <Banner testID="book-error" tone="red" icon="alert-circle" text={failure} />}
      <PatientPicker visible={picking} onClose={() => setPicking(false)} onPick={(p) => { setPatient(p); setPicking(false) }} onAdd={() => { setPicking(false); router.push('/patients/new') }} />
    </Screen>
  )
}
