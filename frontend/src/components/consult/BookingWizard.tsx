import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Check, CheckCircle2, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtINR, fmtTime, todayISO, useCreate, useList, type Doc } from '@/lib/hooks'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/bits'
import { PatientFormDialog } from '@/pages/Patients'
import { cn } from '@/lib/cn'

export const AM_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30']
export const PM_SLOTS = ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30']

const REASONS = [
  'Specialist Opinion',
  'Root Canal Consultation',
  'Implant Consultation',
  'Orthodontic Assessment',
  'Periodontal Evaluation',
  'Pediatric Consultation',
  'Full Mouth Rehabilitation',
]

const STEPS = [
  { n: 1, label: 'Schedule' },
  { n: 2, label: 'Patient' },
  { n: 3, label: 'Confirm' },
]

export function BookingWizard({
  open,
  onClose,
  consultant,
  consultants,
}: {
  open: boolean
  onClose: () => void
  /** The consultant preselected from the card that opened the wizard. */
  consultant?: Doc | null
  /** All consultants available for selection in step 1. */
  consultants: Doc[]
}) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [consultantId, setConsultantId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [time, setTime] = useState('')
  const [patientId, setPatientId] = useState('')
  const [patient, setPatient] = useState('')
  const [patientCode, setPatientCode] = useState('')
  const [reason, setReason] = useState(REASONS[0])
  const [notes, setNotes] = useState('')
  const [consent, setConsent] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [success, setSuccess] = useState<{ booking: string; appt: string } | null>(null)

  const [patientQuery, setPatientQuery] = useState('')
  const [showPatientList, setShowPatientList] = useState(false)
  const [newPatientOpen, setNewPatientOpen] = useState(false)

  const reset = (keepConsultant = true) => {
    setStep(1)
    if (!keepConsultant) setConsultantId('')
    setDate(todayISO())
    setTime('')
    setPatientId('')
    setPatient('')
    setPatientCode('')
    setReason(REASONS[0])
    setNotes('')
    setConsent(false)
    setSuccess(null)
    setPatientQuery('')
  }

  useEffect(() => {
    if (open) {
      reset()
      setConsultantId(consultant?.id ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, consultant])

  const selected = consultants.find((c) => c.id === consultantId)

  const { data: patientData } = useList('patients', { q: patientQuery, limit: 8 }, { enabled: open })
  const { data: dayBookings } = useList(
    'consultant_bookings',
    { consultant: selected?.name, date, limit: 100 },
    { enabled: open && !!selected },
  )
  const { data: patientBookings } = useList(
    'consultant_bookings',
    { consultant: selected?.name, patientCode, limit: 100 },
    { enabled: open && !!selected && !!patientCode },
  )

  const takenTimes = useMemo(
    () => new Set((dayBookings?.items ?? []).filter((b) => b.status !== 'Cancelled').map((b) => b.time)),
    [dayBookings],
  )

  const duplicate = useMemo(() => {
    const month = date.slice(0, 7)
    return (patientBookings?.items ?? []).find(
      (b) => b.status !== 'Cancelled' && String(b.date || '').slice(0, 7) === month,
    )
  }, [patientBookings, date])

  const createBooking = useCreate('consultant_bookings')
  const createAppt = useCreate('appointments', { invalidate: ['dashboard'] })

  const choosePatient = (p: Doc) => {
    setPatientId(p.id)
    setPatient(p.name)
    setPatientCode(p.code)
    setShowPatientList(false)
    setPatientQuery('')
  }

  const confirm = async () => {
    if (!selected || !patient || !time || !consent) return
    if (duplicate) {
      toast.error(`${patient} already has a booking with ${selected.name} this month.`)
      return
    }
    setConfirming(true)
    try {
      const booking = (await createBooking.mutateAsync({
        consultantId: selected.id,
        consultantCode: selected.code,
        consultant: selected.name,
        specialty: selected.specialty,
        fee: selected.fee,
        location: selected.location,
        patientId,
        patient,
        patientCode,
        date,
        time,
        reason,
        notes,
        status: 'Confirmed',
      })) as Doc
      const appt = (await createAppt.mutateAsync({
        patientId,
        patient,
        patientCode,
        date,
        time,
        treatment: `Consultant · ${selected.specialty}`,
        doctor: selected.name,
        chair: 'Consultation Room',
        duration: '30 min',
        status: 'Scheduled',
        notes,
      })) as Doc
      setSuccess({ booking: booking.code, appt: appt.code })
      toast.success('Consultation booked successfully')
    } catch {
      /* error toasts raised by the mutation hooks */
    } finally {
      setConfirming(false)
    }
  }

  const slotButton = (t: string) => {
    const taken = takenTimes.has(t)
    const active = time === t
    return (
      <button
        key={t}
        type="button"
        disabled={taken}
        onClick={() => setTime(t)}
        className={cn(
          'rounded-lg border px-2 py-1.5 text-[13px] font-medium transition',
          taken
            ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through'
            : active
              ? 'border-brand-600 bg-brand-700 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700',
        )}
      >
        {fmtTime(t)}
      </button>
    )
  }

  const summaryRow = (label: string, value: string) => (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="text-right text-[13px] font-semibold text-slate-800">{value}</span>
    </div>
  )

  const footer = success ? (
    <>
      <Button variant="outline" onClick={() => reset()}>Book Another</Button>
      <Button onClick={() => navigate('/appointments')}>
        <CalendarDays className="h-4 w-4" /> View Appointments
      </Button>
    </>
  ) : (
    <>
      {step > 1 ? (
        <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
      ) : (
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      )}
      {step === 1 && (
        <Button disabled={!selected || !date || !time} onClick={() => setStep(2)}>
          Continue
        </Button>
      )}
      {step === 2 && (
        <Button disabled={!patient || !consent || !!duplicate} onClick={() => setStep(3)}>
          Review Booking
        </Button>
      )}
      {step === 3 && (
        <Button loading={confirming} disabled={!!duplicate} onClick={confirm}>
          <Check className="h-4 w-4" /> Confirm Booking
        </Button>
      )}
    </>
  )

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={success ? 'Consultation Confirmed' : 'Book a Consultant'}
        subtitle={
          success
            ? `${patient} is booked with ${selected?.name}`
            : selected
              ? `${selected.name} · ${selected.specialty}`
              : 'Choose a specialist, schedule and patient'
        }
        size="lg"
        footer={footer}
      >
        {success ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <h3 className="text-base font-semibold text-slate-900">Consultation Confirmed</h3>
            <p className="mt-1 max-w-sm text-[13px] text-slate-500">
              {patient} is booked with {selected?.name} on {fmtDate(date)} at {fmtTime(time)}.
            </p>
            <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Booking Ref</div>
                <div className="text-sm font-bold text-slate-800">{success.booking}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Appointment Ref</div>
                <div className="text-sm font-bold text-slate-800">{success.appt}</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              A mirror appointment has been added to the calendar in the Consultation Room.
            </p>
          </div>
        ) : (
          <div>
            {/* Step indicator */}
            <div className="mb-5 flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div key={s.n} className="flex flex-1 items-center gap-2">
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                      step > s.n
                        ? 'bg-emerald-500 text-white'
                        : step === s.n
                          ? 'bg-brand-700 text-white'
                          : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
                  </span>
                  <span
                    className={cn(
                      'text-[13px] font-medium',
                      step === s.n ? 'text-slate-900' : 'text-slate-400',
                    )}
                  >
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <Field label="Consultant" required>
                  <Select
                    value={consultantId}
                    onChange={(e) => { setConsultantId(e.target.value); setTime('') }}
                  >
                    <option value="">Select a consultant…</option>
                    {consultants.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.specialty} ({c.type})
                      </option>
                    ))}
                  </Select>
                </Field>
                {selected && (
                  <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2.5">
                    <Avatar name={selected.name} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-800">{selected.name}</div>
                      <div className="truncate text-xs text-slate-500">
                        {selected.specialty} · {selected.availability} · {selected.location}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-brand-800">{fmtINR(selected.fee)}</span>
                  </div>
                )}
                <Field label="Date" required hint={selected ? `Usual availability: ${selected.availability}` : undefined}>
                  <Input
                    type="date"
                    value={date}
                    min={todayISO()}
                    onChange={(e) => { setDate(e.target.value); setTime('') }}
                  />
                </Field>
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    Time Slot<span className="ml-0.5 text-red-500">*</span>
                  </span>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Morning</div>
                      <div className="grid grid-cols-4 gap-1.5">{AM_SLOTS.map(slotButton)}</div>
                    </div>
                    <div>
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Afternoon</div>
                      <div className="grid grid-cols-4 gap-1.5">{PM_SLOTS.map(slotButton)}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">Struck-out slots are already booked for this consultant.</p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="relative">
                  <Field label="Patient" required>
                    {patient ? (
                      <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2">
                        <Avatar name={patient} className="h-8 w-8" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-800">{patient}</div>
                          <div className="text-xs text-slate-500">{patientCode}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          type="button"
                          onClick={() => { setPatient(''); setPatientId(''); setPatientCode('') }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            value={patientQuery}
                            onChange={(e) => { setPatientQuery(e.target.value); setShowPatientList(true) }}
                            onFocus={() => setShowPatientList(true)}
                            placeholder="Search by name, ID or mobile…"
                          />
                          {showPatientList && (patientData?.items?.length ?? 0) > 0 && (
                            <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
                              {patientData!.items.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => choosePatient(p)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-brand-50"
                                >
                                  <Avatar name={p.name} className="h-7 w-7 text-[11px]" />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                                    <span className="block text-xs text-slate-500">{p.code} · {p.mobile}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button type="button" variant="secondary" onClick={() => setNewPatientOpen(true)}>
                          <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">New</span>
                        </Button>
                      </div>
                    )}
                  </Field>
                </div>

                {duplicate && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
                    {patient} already has booking {duplicate.code} with {selected?.name} on {fmtDate(duplicate.date)}.
                    The same patient can see a consultant only once per calendar month — pick another month or a
                    different consultant.
                  </p>
                )}

                <Field label="Reason for Referral" required>
                  <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                    {REASONS.map((r) => <option key={r}>{r}</option>)}
                  </Select>
                </Field>
                <Field label="Clinical Notes">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Symptoms, duration and relevant clinical findings…"
                    className="min-h-[72px]"
                  />
                </Field>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 accent-teal-700"
                  />
                  <span className="text-[13px] text-slate-700">
                    Patient consent confirmed for the specialist consultation and for sharing the clinical chart
                    with the consultant.<span className="ml-0.5 text-red-500">*</span>
                  </span>
                </label>
              </div>
            )}

            {step === 3 && selected && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 px-4 py-1.5">
                  {summaryRow('Consultant', `${selected.name} · ${selected.specialty}`)}
                  {summaryRow('Patient', `${patient} · ${patientCode}`)}
                  {summaryRow('Date & Time', `${fmtDate(date)} · ${fmtTime(time)}`)}
                  {summaryRow('Location', String(selected.location || 'Clinic'))}
                  {summaryRow('Reason', reason)}
                  {summaryRow('Consultation Fee', fmtINR(selected.fee))}
                </div>
                {notes && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Clinical Notes</div>
                    <p className="mt-0.5 text-[13px] text-slate-700">{notes}</p>
                  </div>
                )}
                <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
                  Confirming creates the consultant booking and a mirror appointment in the Consultation Room.
                </p>
                {duplicate && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
                    Duplicate monthly booking — {patient} already has {duplicate.code} with {selected.name} in this
                    calendar month.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>

      <PatientFormDialog
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        onSaved={(p) => choosePatient(p)}
      />
    </>
  )
}
