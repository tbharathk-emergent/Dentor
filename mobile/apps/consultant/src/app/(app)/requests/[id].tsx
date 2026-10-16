import {
  Banner, Button, Card, Chip, CodeInput, ErrorState, KeyValue, RateVisitSheet, MascotDialog, QueryState, Row, Screen, Section, Sheet, SkeletonList, StatusBadge, T, TextField,
  addDays, colors, errorMessage, fmtDateTime, fmtINR, space, todayISO, useLocalSearchParams, useToast,
} from '@dentor/shared'
import { useMemo, useState } from 'react'
import { Image, ScrollView, View } from 'react-native'
import mascot from '@/assets/design/mascot-happy.png'
import {
  useAccept, useCancelRequest, useComplete, useDecline, useMySlots, usePropose, useRequest, useStart, useTrack, useVitals, type ConsultRequest,
} from '@/hooks/useRequests'

type SheetName = null | 'accept' | 'propose' | 'decline' | 'late' | 'start' | 'vitals' | 'complete' | 'cancel' | 'rate'

/**
 * One request from a clinic: the case ("Appointment summary" 3973:32234, "Case summary" 3973:33724) and,
 * step by step, Accept / offer other times / decline, on the way, arrived, "Start Procedure" with the
 * clinic's 4-digit code (3973:42644), vitals (3973:41000) and "End Procedure" with the next sitting (3973:42694).
 */
export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const request = useRequest(id)
  return (
    <Screen testID="request-screen" title="Appointment Summary" back>
      <QueryState query={request}>{(b) => <RequestBody b={b} />}</QueryState>
    </Screen>
  )
}

function RequestBody({ b }: { b: ConsultRequest }) {
  const toast = useToast()
  const [sheet, setSheet] = useState<SheetName>(null)
  const [done, setDone] = useState<string | null>(null)
  const accept = useAccept()
  const track = useTrack()
  const open = ['Requested', 'Viewed'].includes(b.status)
  const live = ['Confirmed', 'On the way', 'Running late', 'Arrived'].includes(b.status)
  const ok = (message: string) => () => {
    setSheet(null)
    toast.success(message)
  }

  const acceptAsRequested = () =>
    accept.mutate({ id: b.id }, { onSuccess: () => setDone(`Confirmed: ${b.patient} on ${b.date_label} at ${b.time_label}. The clinic has been told.`), onError: (e) => toast.error(e) })

  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>{b.patient}</T>
          <StatusBadge status={b.status} />
        </View>
        <KeyValue label="Case ID" value={b.code} />
        <KeyValue label="Treatment" value={b.treatment} />
        <KeyValue label="When" value={b.date ? `${b.date_label} · ${b.time_label}` : b.dentor_type_label ? `${b.dentor_type_label}: you choose the time` : ''} />
        {b.choice === 'dentor' && !b.consultant && <Banner tone="blue" icon="info" text="An open request: the first consultant to accept takes it." />}
        <KeyValue label="Fee" value={b.fee ? `${fmtINR(b.fee)}${b.extra_fee ? ` + ${fmtINR(b.extra_fee)}` : ''}` : ''} />
      </Card>

      {open && (
        <View style={{ gap: space.sm }}>
          {b.date && b.time ? (
            <Button testID="request-accept" label="Accept" icon="check" size="lg" full loading={accept.isPending} onPress={acceptAsRequested} />
          ) : (
            <Button testID="request-accept-pick" label="Accept and choose a time" icon="check" size="lg" full onPress={() => setSheet('accept')} />
          )}
          {b.mine && <Button testID="request-propose" label="Offer other times" icon="clock" variant="secondary" full onPress={() => setSheet('propose')} />}
          {b.mine && <Button testID="request-decline" label="Decline" icon="x" variant="ghost" full onPress={() => setSheet('decline')} />}
        </View>
      )}

      {live && (
        <Section title="On the day">
          <Row wrap gap={space.sm}>
            <Chip testID="track-on-the-way" label="On the way" selected={b.status === 'On the way'} onPress={() => track.mutate({ id: b.id, status: 'On the way' }, { onSuccess: () => toast.success('The clinic knows you are on the way.'), onError: (e) => toast.error(e) })} />
            <Chip testID="track-late" label="Running late" selected={b.status === 'Running late'} onPress={() => setSheet('late')} />
            <Chip testID="track-arrived" label="Arrived" selected={b.status === 'Arrived'} onPress={() => track.mutate({ id: b.id, status: 'Arrived' }, { onSuccess: () => toast.success('The clinic knows you have arrived.'), onError: (e) => toast.error(e) })} />
          </Row>
          <Button testID="request-start" label="Start Procedure" icon="play" size="lg" full onPress={() => setSheet('start')} />
          <Button testID="request-cancel" label="Cancel appointment" icon="x" variant="ghost" full onPress={() => setSheet('cancel')} />
        </Section>
      )}

      {b.status === 'Started' && (
        <Section title="Procedure started">
          <Button testID="request-vitals" label="Update vitals" icon="activity" variant="secondary" full onPress={() => setSheet('vitals')} />
          <Button testID="request-complete" label="End Procedure" icon="check-circle" size="lg" full onPress={() => setSheet('complete')} />
        </Section>
      )}

      {b.status === 'Completed' && !(b as { rated_by_consultant?: number }).rated_by_consultant && (
        <Button testID="rate-clinic" label="Rate the clinic" icon="star" variant="secondary" full onPress={() => setSheet('rate')} />
      )}
      <RateVisitSheet bookingId={b.id} visible={sheet === 'rate'} title="Rate your experience with the clinic" onClose={() => setSheet(null)}
        aspects={['Sterilization protocol', 'Appointment maintenance', 'Patient preparation', 'Staff support']} />
      {b.status === 'Completed' && (
        <Card>
          <KeyValue label="Treatment provided" value={b.treatment_provided} />
          <KeyValue label="Notes" value={b.completion_notes} />
          {!!b.next_visit && <KeyValue label="Next sitting" value={`${b.next_visit.date} ${b.next_visit.time}`} />}
        </Card>
      )}
      {!!b.cancelReason && <Banner tone="red" icon="info" text={`Reason: ${b.cancelReason}`} />}

      <Section title="Case summary">
        <Card>
          <KeyValue label="Patient ID" value={b.patientCode} />
          <KeyValue label="Provisional diagnosis" value={b.diagnosis} />
          <KeyValue label="Tooth no." value={b.teeth.join(', ')} />
          <KeyValue label="Quadrant" value={b.quadrants.map((q) => (q === 'full' ? 'Full mouth' : q)).join(', ')} />
          <KeyValue label="BP (mmHg)" value={b.vitals?.bp} />
          <KeyValue label="Glucose (mg/dL)" value={b.vitals?.glucose} />
          <KeyValue label="History" value={[...b.history, b.history_note].filter(Boolean).join(', ')} />
          <KeyValue label="Lab findings" value={b.lab_findings} />
          <KeyValue label="Notes" value={b.notes} />
        </Card>
        {!!b.image_data?.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {b.image_data.map((src, i) => <Image key={i} source={{ uri: src }} style={{ width: 120, height: 120, borderRadius: 12 }} accessibilityLabel={`Intra-oral image ${i + 1}`} />)}
          </ScrollView>
        )}
      </Section>

      <Section title="Status">
        {b.timeline.map((t, i) => <T key={i} variant="small" color={colors.textMuted}>{`${t.status} · ${fmtDateTime(t.at)}${t.note ? ` · ${t.note}` : ''}`}</T>)}
      </Section>

      <AcceptSheet b={b} visible={sheet === 'accept'} onClose={() => setSheet(null)} onDone={(text) => { setSheet(null); setDone(text) }} />
      <ProposeSheet b={b} visible={sheet === 'propose'} onClose={() => setSheet(null)} onDone={ok('Times offered. The clinic will choose one.')} />
      <ReasonSheet b={b} kind="decline" visible={sheet === 'decline'} onClose={() => setSheet(null)} onDone={ok('Declined. The clinic has been told.')} />
      <ReasonSheet b={b} kind="cancel" visible={sheet === 'cancel'} onClose={() => setSheet(null)} onDone={ok('Cancelled. The clinic has been told.')} />
      <LateSheet b={b} visible={sheet === 'late'} onClose={() => setSheet(null)} onDone={ok('The clinic knows you are running late.')} />
      <StartSheet b={b} visible={sheet === 'start'} onClose={() => setSheet(null)} onDone={ok('Procedure started.')} />
      <VitalsSheet b={b} visible={sheet === 'vitals'} onClose={() => setSheet(null)} onDone={ok('Vitals updated.')} />
      <CompleteSheet b={b} visible={sheet === 'complete'} onClose={() => setSheet(null)} onDone={(text) => { setSheet(null); setDone(text) }} />
      <MascotDialog testID="request-done" visible={!!done} image={mascot} title="Done" message={done ?? ''} actions={[{ label: 'OK', testID: 'request-done-ok', onPress: () => setDone(null) }]} onClose={() => setDone(null)} />
    </>
  )
}

function DayAndSlot({ date, setDate, time, setTime }: { date: string; setDate: (d: string) => void; time: string; setTime: (t: string) => void }) {
  const dates = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(todayISO(), i)), [])
  const slots = useMySlots(date)
  return (
    <View style={{ gap: space.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
        {dates.map((d) => <Chip key={d} testID={`pick-date-${d}`} label={d.slice(5).split('-').reverse().join('/')} selected={d === date} onPress={() => { setDate(d); setTime('') }} />)}
      </ScrollView>
      {slots.isLoading ? <SkeletonList rows={1} /> : slots.isError ? <ErrorState error={slots.error} onRetry={() => slots.refetch()} /> : slots.data?.slots.some((s) => s.available) ? (
        <Row wrap gap={space.xs}>
          {slots.data.slots.map((s) => <Chip key={s.time} testID={`pick-slot-${s.time}`} label={s.label} disabled={!s.available} selected={time === s.time} onPress={() => setTime(s.time)} />)}
        </Row>
      ) : (
        <Banner tone="amber" icon="calendar" text="You have no free time on this day. Set your availability, or choose another day." />
      )}
    </View>
  )
}

function AcceptSheet({ b, visible, onClose, onDone }: { b: ConsultRequest; visible: boolean; onClose: () => void; onDone: (text: string) => void }) {
  const accept = useAccept()
  const [date, setDate] = useState(addDays(todayISO(), 1))
  const [time, setTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet testID="accept-sheet" visible={visible} onClose={onClose} title="Choose your time" subtitle={b.dentor_type_label}
      footer={<Button testID="accept-confirm" label="Accept" size="lg" full loading={accept.isPending} onPress={() => {
        if (!time) return setError('Choose a time.')
        accept.mutate({ id: b.id, date, time }, { onSuccess: (next) => onDone(`Confirmed: ${next.patient} on ${next.date_label} at ${next.time_label}.`), onError: (e) => setError(errorMessage(e)) })
      }} />}>
      <DayAndSlot date={date} setDate={setDate} time={time} setTime={setTime} />
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
    </Sheet>
  )
}

function ProposeSheet({ b, visible, onClose, onDone }: { b: ConsultRequest; visible: boolean; onClose: () => void; onDone: () => void }) {
  const propose = usePropose()
  const [date, setDate] = useState(b.date || addDays(todayISO(), 1))
  const [time, setTime] = useState('')
  const [picked, setPicked] = useState<{ date: string; time: string }[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet testID="propose-sheet" visible={visible} onClose={onClose} title="Offer other times" subtitle="Choose up to three; the clinic picks one"
      footer={<Button testID="propose-send" label={`Send ${picked.length || ''} time${picked.length === 1 ? '' : 's'}`} size="lg" full loading={propose.isPending} onPress={() => {
        if (!picked.length) return setError('Add at least one time.')
        propose.mutate({ id: b.id, slots: picked, note: note.trim() }, { onSuccess: onDone, onError: (e) => setError(errorMessage(e)) })
      }} />}>
      <DayAndSlot date={date} setDate={setDate} time={time} setTime={setTime} />
      <Button testID="propose-add" label="Add this time" icon="plus" variant="secondary" full disabled={!time || picked.length >= 3}
        onPress={() => { if (!picked.some((p) => p.date === date && p.time === time)) setPicked([...picked, { date, time }]); setTime('') }} />
      <Row wrap gap={space.xs}>{picked.map((p, i) => <Chip key={i} label={`${p.date.slice(5)} ${p.time} ✕`} selected onPress={() => setPicked(picked.filter((_, j) => j !== i))} />)}</Row>
      <TextField testID="propose-note" label="Note to the clinic" value={note} onChangeText={setNote} maxLength={200} />
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
    </Sheet>
  )
}

const REASONS = ['Prosthesis not arrived', 'Infection does not subside', 'Power shutdown', 'Patient unwell', 'Not available that day']

function ReasonSheet({ b, kind, visible, onClose, onDone }: { b: ConsultRequest; kind: 'decline' | 'cancel'; visible: boolean; onClose: () => void; onDone: () => void }) {
  const decline = useDecline()
  const cancel = useCancelRequest()
  const action = kind === 'decline' ? decline : cancel
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet testID={`${kind}-sheet`} visible={visible} onClose={onClose} title={kind === 'decline' ? 'Decline request' : 'Cancel appointment'} subtitle={`${b.patient} · ${b.treatment}`}
      footer={<Button testID={`${kind}-confirm`} label={kind === 'decline' ? 'Decline' : 'Cancel appointment'} variant="danger" size="lg" full loading={action.isPending} onPress={() => {
        if (reason.trim().length < 3) return setError('Give a reason.')
        action.mutate({ id: b.id, reason: reason.trim() }, { onSuccess: onDone, onError: (e) => setError(errorMessage(e)) })
      }} />}>
      <Row wrap gap={space.xs}>{REASONS.map((r) => <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />)}</Row>
      <TextField testID={`${kind}-reason`} label="Reason" required value={reason} onChangeText={setReason} maxLength={200} />
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
    </Sheet>
  )
}

function LateSheet({ b, visible, onClose, onDone }: { b: ConsultRequest; visible: boolean; onClose: () => void; onDone: () => void }) {
  const track = useTrack()
  const [minutes, setMinutes] = useState(15)
  return (
    <Sheet testID="late-sheet" visible={visible} onClose={onClose} title="Running late"
      footer={<Button testID="late-confirm" label={`Tell the clinic: ${minutes} minutes`} size="lg" full loading={track.isPending}
        onPress={() => track.mutate({ id: b.id, status: 'Running late', minutes }, { onSuccess: onDone })} />}>
      <Row wrap gap={space.sm}>{[10, 15, 30, 45, 60].map((m) => <Chip key={m} testID={`late-${m}`} label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} />)}</Row>
    </Sheet>
  )
}

function StartSheet({ b, visible, onClose, onDone }: { b: ConsultRequest; visible: boolean; onClose: () => void; onDone: () => void }) {
  const start = useStart()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | undefined>()
  return (
    <Sheet testID="start-sheet" visible={visible} onClose={onClose} title="Start Procedure" subtitle="Enter the 4-digit code the clinic reads to you"
      footer={<Button testID="start-confirm" label="Start" size="lg" full loading={start.isPending} onPress={() => {
        if (code.length !== 4) return setError('Enter the 4-digit code.')
        start.mutate({ id: b.id, code }, { onSuccess: onDone, onError: (e) => { setCode(''); setError(errorMessage(e)) } })
      }} />}>
      <CodeInput testID="start-code-input" value={code} onChange={setCode} error={error} />
    </Sheet>
  )
}

function VitalsSheet({ b, visible, onClose, onDone }: { b: ConsultRequest; visible: boolean; onClose: () => void; onDone: () => void }) {
  const vitals = useVitals()
  const [bp, setBp] = useState(b.vitals?.bp ?? '')
  const [glucose, setGlucose] = useState(b.vitals?.glucose ?? '')
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet testID="vitals-sheet" visible={visible} onClose={onClose} title="Vitals update"
      footer={<Button testID="vitals-save" label="Save" size="lg" full loading={vitals.isPending} onPress={() => vitals.mutate({ id: b.id, bp: bp.trim(), glucose: glucose.trim() }, { onSuccess: onDone, onError: (e) => setError(errorMessage(e)) })} />}>
      <TextField testID="vitals-bp" label="BP (mmHg)" value={bp} onChangeText={setBp} placeholder="120/80" keyboardType="numbers-and-punctuation" maxLength={7} />
      <TextField testID="vitals-glucose" label="Glucose (mg/dL)" value={glucose} onChangeText={setGlucose} placeholder="110" keyboardType="decimal-pad" maxLength={5} />
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
    </Sheet>
  )
}

function CompleteSheet({ b, visible, onClose, onDone }: { b: ConsultRequest; visible: boolean; onClose: () => void; onDone: (text: string) => void }) {
  const complete = useComplete()
  const [provided, setProvided] = useState('')
  const [notes, setNotes] = useState('')
  const [next, setNext] = useState(false)
  const [date, setDate] = useState(addDays(todayISO(), 7))
  const [time, setTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet testID="complete-sheet" visible={visible} onClose={onClose} title="End Procedure"
      footer={<Button testID="complete-confirm" label="Complete" size="lg" full loading={complete.isPending} onPress={() => {
        if (provided.trim().length < 2) return setError('Say what treatment was provided.')
        if (next && !time) return setError('Choose the time of the next sitting.')
        complete.mutate({ id: b.id, treatment_provided: provided.trim(), notes: notes.trim(), next_date: next ? date : undefined, next_time: next ? time : undefined }, {
          onSuccess: (r) => onDone(r.next_visit ? `The procedure for this session is complete. The next session is on ${r.next_visit.date} at ${r.next_visit.time}.` : 'The procedure is complete.'),
          onError: (e) => setError(errorMessage(e)),
        })
      }} />}>
      <TextField testID="complete-provided" label="Treatment provided" required value={provided} onChangeText={setProvided} maxLength={300} />
      <TextField testID="complete-notes" label="Notes" value={notes} onChangeText={setNotes} multiline maxLength={1000} />
      <T variant="smallStrong">Next visit required</T>
      <Row gap={space.sm}>
        <Chip testID="next-yes" label="Yes" selected={next} onPress={() => setNext(true)} />
        <Chip testID="next-no" label="No" selected={!next} onPress={() => setNext(false)} />
      </Row>
      {next && <DayAndSlot date={date} setDate={setDate} time={time} setTime={setTime} />}
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
    </Sheet>
  )
}
