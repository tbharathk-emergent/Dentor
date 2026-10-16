import { Button, Sheet, useToast } from '@dentor/shared'
import { useEffect, useState } from 'react'
import { SlotPicker } from '@/components/appointments/SlotPicker'
import { isSlotTaken, slotTakenNotice, useRescheduleAppointment } from '@/hooks/useAppointments'
import { upcomingDays } from '@/lib/dates'
import type { Appointment } from '@/types'

/** Pick a new day and time with the same doctor. */
export function RescheduleSheet({ appointment, visible, onClose }: { appointment: Appointment; visible: boolean; onClose: () => void }) {
  const toast = useToast()
  const reschedule = useRescheduleAppointment(appointment.id)
  const [date, setDate] = useState(appointment.date)
  const [time, setTime] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  // Start each visit to the sheet from the appointment's own day (or today, if that is past).
  useEffect(() => {
    if (!visible) return
    const days = upcomingDays()
    setDate(days.includes(appointment.date) ? appointment.date : days[0])
    setTime('')
    setNotice(null)
  }, [visible, appointment.date])

  const pickDate = (next: string) => {
    setDate(next)
    setTime('')
    setNotice(null)
  }

  const pickTime = (next: string) => {
    setTime(next)
    setNotice(null)
  }

  const confirm = () =>
    reschedule.mutate(
      { date, time },
      {
        onSuccess: (moved) => {
          toast.success(`Moved to ${moved.date_label}, ${moved.time_label}`)
          onClose()
        },
        onError: (error) => {
          if (isSlotTaken(error)) {
            setTime('')
            setNotice(slotTakenNotice(error))
          } else {
            toast.error(error)
          }
        },
      },
    )

  const unchanged = date === appointment.date && time === appointment.time
  return (
    <Sheet
      testID="reschedule-sheet"
      visible={visible}
      onClose={onClose}
      title="Reschedule"
      subtitle={`Now ${appointment.date_label} at ${appointment.time_label} · ${appointment.doctor}`}
      footer={
        <Button
          testID="reschedule-confirm"
          label={time ? 'Confirm new time' : 'Choose a time'}
          onPress={confirm}
          disabled={!time || unchanged}
          loading={reschedule.isPending}
          full
        />
      }
    >
      <SlotPicker doctor={appointment.doctor} date={date} time={time} onDate={pickDate} onTime={pickTime} notice={notice} />
    </Sheet>
  )
}
