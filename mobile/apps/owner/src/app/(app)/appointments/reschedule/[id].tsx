import { Banner, Button, Card, Chip, ErrorState, KeyValue, QueryState, Row, Screen, Section, SkeletonList, T, TextField, addDays, colors, errorMessage, space, todayISO, useLocalSearchParams, useToast } from '@dentor/shared'
import { useMemo, useState } from 'react'
import { useAppointment, useReschedule, useSlots } from '@/clinic/hooks'
import { DateStrip } from '@/components/clinic/DateStrip'
import { SlotGrid } from '@/components/clinic/SlotGrid'
import { useRouter } from '@/nav'

const REASONS = ['Patient request', 'Doctor unavailable', 'Treatment needs more time', 'Emergency']

/** "RE - SCHEDULE APPOINMENT" (dentor.fig 7970:4747, 4831, 4803): new day and time, a reason, confirmation. A draft is booked here. */
export default function Reschedule() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const appointment = useAppointment(id)
  const move = useReschedule()
  const dates = useMemo(() => Array.from({ length: 30 }, (_, i) => addDays(todayISO(), i)), [])
  const [date, setDate] = useState(dates[0])
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const a = appointment.data
  const draft = a?.status === 'Draft'
  const slots = useSlots(date, a?.doctor ?? '', id)

  const submit = () => {
    if (!a) return
    const found = { time: time ? undefined : 'Choose a free time.', reason: draft || reason.trim() ? undefined : 'Give a reason for rescheduling.' }
    setErrors(found)
    setFailure(null)
    if (Object.values(found).some(Boolean)) return
    move.mutate(
      { id, date, time, reason: reason.trim() },
      {
        onSuccess: (next) => {
          toast.success(draft ? `Booked: ${next.date_label} at ${next.time_label}.` : `Rescheduled to ${next.date_label} at ${next.time_label}. ${next.patient} has been told.`)
          router.back()
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
      testID="reschedule-screen"
      title={draft ? 'Book Draft' : 'Re-Schedule Appointment'}
      back
      footer={<Button testID="reschedule-submit" label={draft ? 'Book appointment' : 'Confirm reschedule'} size="lg" full loading={move.isPending} onPress={submit} />}
    >
      <QueryState query={appointment}>
        {(data) => (
          <>
            <Card>
              <KeyValue label="Patient" value={data.patient} />
              <KeyValue label="Doctor" value={data.doctor} />
              {!draft && <KeyValue label="Original date" value={`${data.date_label} · ${data.time_label}`} />}
            </Card>
            <Section title="Select Date">
              <DateStrip dates={dates} value={date} today={dates[0]} onChange={(d) => { setDate(d); setTime('') }} />
            </Section>
            <Section title="Time">
              {slots.isLoading ? <SkeletonList rows={2} /> : slots.isError ? <ErrorState error={slots.error} onRetry={() => slots.refetch()} /> : slots.data && slots.data.slots.some((s) => s.available) ? (
                <SlotGrid slots={slots.data.slots} value={time} onChange={setTime} />
              ) : (
                <Banner tone="amber" icon="calendar" text={`${data.doctor} has no free time on this day. Choose another day.`} />
              )}
              {!!errors.time && <T variant="small" color={colors.red}>{errors.time}</T>}
            </Section>
            {!draft && (
              <Section title="Reason">
                <Row wrap gap={space.sm}>
                  {REASONS.map((r) => <Chip key={r} testID={`reason-${r}`} label={r} selected={reason === r} onPress={() => setReason(r)} />)}
                </Row>
                <TextField testID="reschedule-reason" value={reason} onChangeText={setReason} placeholder="Why it is moving" error={errors.reason} maxLength={200} />
              </Section>
            )}
            {!!failure && <Banner testID="reschedule-error" tone="red" icon="alert-circle" text={failure} />}
          </>
        )}
      </QueryState>
    </Screen>
  )
}
