import { Banner, Button, Screen, T, colors, useLocalSearchParams } from '@dentor/shared'
import { useState } from 'react'
import { CallbackSheet } from '@/components/booking/CallbackSheet'
import { SuccessView } from '@/components/SuccessView'
import { SlotPicker } from '@/components/appointments/SlotPicker'
import { BookingClosed } from '@/components/booking/BookingClosed'
import { BookingSummary } from '@/components/booking/BookingSummary'
import { DetailsStep } from '@/components/booking/DetailsStep'
import { DoctorStep } from '@/components/booking/DoctorStep'
import { StepProgress } from '@/components/booking/StepProgress'
import { useDoctors } from '@/hooks/useAppointments'
import { BOOKING_STEPS, DEFAULT_REASON, useBookingFlow, type BookingStep } from '@/hooks/useBookingFlow'
import { useMe } from '@/hooks/useMe'
import { useRefresh } from '@/hooks/useRefresh'
import { useRouter } from '@/nav'

const STEP_LABEL: Record<BookingStep, string> = {
  doctor: 'Choose a doctor',
  slot: 'Pick a date and time',
  details: 'Tell us about the visit',
  review: 'Check and confirm',
}

export default function Book() {
  const router = useRouter()
  const me = useMe()
  const doctors = useDoctors()
  // opened from a clinic offer (patient-app offers): the offer is counted when this visit is booked
  const params = useLocalSearchParams<{ offer?: string; offerTitle?: string; treatment?: string }>()
  const flow = useBookingFlow(params.offer ? { id: params.offer, treatment: params.treatment } : undefined)
  const [callback, setCallback] = useState(false)
  const { refreshing, onRefresh } = useRefresh(doctors.refetch, me.refetch)

  const clinic = me.data?.clinic
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'))
  const { booked, doctor, step } = flow

  if (booked) {
    return (
      <Screen
        testID="booking-success"
        footer={
          <>
            <Button
              testID="booking-view"
              label="View appointment"
              size="lg"
              full
              onPress={() => router.replace({ pathname: '/appointment/[id]', params: { id: booked.id } })}
            />
            <Button testID="booking-done" label="Done" variant="ghost" full onPress={leave} />
          </>
        }
      >
        <SuccessView title="Appointment booked" message={`We will see you on ${booked.date_label} at ${booked.time_label}.`}>
          <BookingSummary doctor={booked.doctor} date={booked.date} time={booked.time} reason={booked.treatment} notes={booked.notes} clinic={clinic} />
        </SuccessView>
      </Screen>
    )
  }

  if (flow.closedReason !== null || clinic?.online_booking === false) {
    return (
      <Screen testID="book-screen" title="Book Appointment" back>
        <BookingClosed clinic={clinic} reason={flow.closedReason ?? undefined} />
      </Screen>
    )
  }

  return (
    <Screen
      testID="book-screen"
      title="Book Appointment"
      subtitle={clinic?.name}
      back
      onBack={flow.isFirstStep ? leave : flow.previous}
      footer={
        step === 'review' ? (
          <Button testID="booking-confirm" label="Confirm booking" size="lg" full loading={flow.confirming} onPress={flow.confirm} />
        ) : (
          <Button testID="booking-next" label="Continue" size="lg" full disabled={!flow.ready} onPress={flow.next} />
        )
      }
      refreshing={refreshing}
      onRefresh={step === 'doctor' ? onRefresh : undefined}
    >
      <StepProgress step={flow.stepNumber} total={BOOKING_STEPS.length} label={STEP_LABEL[step]} />

      {!!params.offerTitle && <Banner testID="booking-offer" tone="green" icon="gift" text={`Booking with the offer: ${params.offerTitle}`} />}
      {step === 'doctor' && (
        <>
          {/* "SCHEDULER" quick actions (patient-app.fig 18:163); video consultation is an agreed exclusion */}
          <Button testID="booking-callback" label="Request Callback" icon="phone-call" variant="secondary" full onPress={() => setCallback(true)} />
          <DoctorStep doctors={doctors} selectedId={doctor?.id} onSelect={flow.pickDoctor} />
        </>
      )}
      <CallbackSheet visible={callback} onClose={() => setCallback(false)} />

      {step === 'slot' && doctor && (
        <>
          <T variant="small" color={colors.textMuted}>With {doctor.name}. Greyed-out times are already taken or have passed.</T>
          <SlotPicker doctor={doctor.name} date={flow.date} time={flow.time} onDate={flow.pickDate} onTime={flow.pickTime} notice={flow.slotNotice} />
        </>
      )}

      {step === 'details' && <DetailsStep reason={flow.reason} notes={flow.notes} onReason={flow.setReason} onNotes={flow.setNotes} />}

      {step === 'review' && doctor && (
        <>
          <BookingSummary
            doctor={doctor.name}
            date={flow.date}
            time={flow.time}
            reason={flow.reason.trim() || DEFAULT_REASON}
            notes={flow.notes.trim()}
            clinic={clinic}
          />
          <T variant="small" color={colors.textMuted}>You can reschedule or cancel later from My Appointments.</T>
        </>
      )}
    </Screen>
  )
}
