import { errorMessage, todayISO, useToast } from '@dentor/shared'
import { useState } from 'react'
import { isBookingOff, isSlotTaken, slotTakenNotice, useBookAppointment } from '@/hooks/useAppointments'
import type { Appointment, Doctor } from '@/types'

export const BOOKING_STEPS = ['doctor', 'slot', 'details', 'review'] as const
export type BookingStep = (typeof BOOKING_STEPS)[number]

/** What a visit is booked as when the patient gives no reason. */
export const DEFAULT_REASON = 'Consultation'

/**
 * The booking wizard: doctor → date and time → reason → review → booked.
 * Two refusals get their own treatment: a slot someone else just took sends the patient back
 * to the (reloaded) times with a notice, and a clinic that has switched online booking off
 * ends the wizard with the reason, so the screen can offer the phone call instead.
 */
export function useBookingFlow(offer?: { id: string; treatment?: string }) {
  const toast = useToast()
  const book = useBookAppointment()
  const [step, setStep] = useState<BookingStep>('doctor')
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [date, setDate] = useState(todayISO)
  const [time, setTime] = useState('')
  const [reason, setReason] = useState(offer?.treatment ?? '')
  const [notes, setNotes] = useState('')
  const [slotNotice, setSlotNotice] = useState<string | null>(null)
  const [closedReason, setClosedReason] = useState<string | null>(null)
  const [booked, setBooked] = useState<Appointment | null>(null)

  const index = BOOKING_STEPS.indexOf(step)

  const pickDoctor = (next: Doctor) => {
    if (next.id !== doctor?.id) setTime('')
    setDoctor(next)
  }
  const pickDate = (next: string) => {
    setDate(next)
    setTime('')
    setSlotNotice(null)
  }
  const pickTime = (next: string) => {
    setTime(next)
    setSlotNotice(null)
  }

  const confirm = () => {
    if (!doctor || book.isPending) return
    book.mutate(
      { date, time, doctor: doctor.name, reason: reason.trim(), notes: notes.trim(), offer_id: offer?.id },
      {
        onSuccess: setBooked,
        onError: (error) => {
          if (isBookingOff(error)) {
            setClosedReason(errorMessage(error))
          } else if (isSlotTaken(error)) {
            setTime('')
            setSlotNotice(slotTakenNotice(error))
            setStep('slot')
          } else {
            toast.error(error)
          }
        },
      },
    )
  }

  return {
    step,
    stepNumber: index + 1,
    doctor,
    date,
    time,
    reason,
    notes,
    slotNotice,
    closedReason,
    booked,
    confirming: book.isPending,
    /** The current step has what it needs to move on. */
    ready: step === 'doctor' ? !!doctor : step === 'slot' ? !!time : true,
    isFirstStep: index === 0,
    pickDoctor,
    pickDate,
    pickTime,
    setReason,
    setNotes,
    next: () => setStep(BOOKING_STEPS[Math.min(index + 1, BOOKING_STEPS.length - 1)]),
    previous: () => setStep(BOOKING_STEPS[Math.max(index - 1, 0)]),
    confirm,
  }
}
