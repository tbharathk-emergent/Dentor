import { Banner } from '@dentor/shared'
import { useAppointment } from '@/hooks/useAppointments'
import type { Appointment } from '@/types'
import { AppointmentActions } from './AppointmentActions'
import { AppointmentCard } from './AppointmentCard'

/**
 * The next patient to see, with their allergy (if any) called out before they sit down
 * and the same quick actions as the list below.
 */
export function NextUpCard({ appointment, onOpen }: { appointment: Appointment; onOpen: () => void }) {
  // The list does not carry the patient's record; the appointment itself does.
  const detail = useAppointment(appointment.id)
  const allergy = detail.data?.patient_record?.allergy?.trim()
  return (
    <AppointmentCard appointment={appointment} onPress={onOpen} highlight testID="next-up">
      {!!allergy && <Banner tone="red" icon="alert-triangle" text={`Allergy: ${allergy}`} />}
      <AppointmentActions appointment={appointment} testID="next-up" />
    </AppointmentCard>
  )
}
