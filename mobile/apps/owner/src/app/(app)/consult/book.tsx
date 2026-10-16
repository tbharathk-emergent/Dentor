import {
  Banner, Button, Card, Chip, EmptyState, ErrorState, ListRow, MascotDialog, Row, Screen, Section, Segmented, SkeletonList, T, TextField,
  addDays, colors, errorMessage, face, fmtINR, fmtTime, pickImage, radius, space, todayISO, useLocalSearchParams, useToast,
} from '@dentor/shared'
import { useMemo, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { HISTORY, QUADRANTS, TEETH, TREATMENTS, useConsultSlots, useSendRequest, useVisiting } from '@/clinic/consult'
import type { PatientRow } from '@/clinic/types'
import mascot from '@/assets/design/mascot-happy.png'
import { DateStrip } from '@/components/clinic/DateStrip'
import { PatientPicker } from '@/components/clinic/PatientPicker'
import { useRouter } from '@/nav'

type Step = 'case' | 'choice'
const PEAK = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30']
const DAY_TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']
const MAX_IMAGES = 4

/**
 * "BOOK YOUR APPOINTMENT" (dentor.fig 6470:3924 and its pickers: quadrant 2897:1108, tooth 4019:2334,
 * medical history 4019:2434, treatment needed 4904:3483), then "own choice" — a consultant near the clinic
 * and one of their slots (7648:3664, 7712:4441) — or "Dentor choice" with an appointment type (6349:3575,
 * 6349:3618, 7067:4212). The declaration is required. Fees are shown; payment is at the clinic.
 */
export default function BookConsultant() {
  const router = useRouter()
  const toast = useToast()
  const params = useLocalSearchParams<{ specialty?: string }>()
  const send = useSendRequest()
  const dates = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(todayISO(), i)), [])
  const [step, setStep] = useState<Step>('case')
  const [patient, setPatient] = useState<PatientRow | null>(null)
  const [picking, setPicking] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [teeth, setTeeth] = useState<string[]>([])
  const [quadrants, setQuadrants] = useState<string[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>([])
  const [choice, setChoice] = useState<'own' | 'dentor'>('own')
  const [specialty, setSpecialty] = useState(params.specialty ?? '')
  const [consultantId, setConsultantId] = useState('')
  const [dentorType, setDentorType] = useState<'standard' | 'peak' | 'preferred'>('standard')
  const [date, setDate] = useState(dates[1])
  const [time, setTime] = useState('')
  const [declared, setDeclared] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [sent, setSent] = useState<null | { id: string; title: string; message: string }>(null)
  const consultants = useVisiting(specialty)
  const slots = useConsultSlots(choice === 'own' ? consultantId : '', date)
  const v = (k: string) => form[k] ?? ''
  const set = (k: string) => (text: string) => setForm((f) => ({ ...f, [k]: text }))
  const toggle = (list: string[], setList: (l: string[]) => void, value: string) => setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  const attach = async () => {
    try {
      const file = await pickImage()
      if (!file) return
      if (file.size > 2 * 1024 * 1024) return toast.error(new Error('Choose a photo of up to 2 MB.'))
      setImages((list) => [...list, { name: file.name, dataUrl: file.dataUrl }].slice(0, MAX_IMAGES))
    } catch (e) {
      toast.error(e)
    }
  }

  const nextStep = () => {
    const found = {
      patient: patient ? undefined : 'Choose the patient.',
      treatment: v('treatment').trim() ? undefined : 'Choose or write the treatment needed.',
      bp: v('bp') && !/^\d{2,3}\/\d{2,3}$/.test(v('bp').trim()) ? 'Write it like 120/80.' : undefined,
      glucose: v('glucose') && !/^\d{2,3}(\.\d)?$/.test(v('glucose').trim()) ? 'Write it in mg/dL, like 110.' : undefined,
    }
    setErrors(found)
    if (!Object.values(found).some(Boolean)) setStep('choice')
  }

  const submit = () => {
    if (!patient) return
    const needsTime = choice === 'own' || dentorType !== 'standard'
    const found = {
      consultant: choice === 'own' && !consultantId ? 'Choose a consultant.' : undefined,
      time: needsTime && !time ? 'Choose a time.' : undefined,
      declared: declared ? undefined : 'Confirm the declaration to send the request.',
    }
    setErrors(found)
    setFailure(null)
    if (Object.values(found).some(Boolean)) return
    send.mutate(
      {
        patient_id: patient.id, choice, consultant_id: choice === 'own' ? consultantId : undefined, dentor_type: choice === 'dentor' ? dentorType : undefined,
        date: needsTime ? date : undefined, time: needsTime ? time : undefined, diagnosis: v('diagnosis').trim(), treatment: v('treatment').trim(),
        teeth, quadrants, history, history_note: v('history_note').trim(), lab_findings: v('lab').trim(), bp: v('bp').trim(), glucose: v('glucose').trim(),
        notes: v('notes').trim(), images: images.map((i) => i.dataUrl), declaration: declared,
      },
      {
        onSuccess: (b) =>
          setSent({
            id: b.id,
            title: choice === 'dentor' ? 'BOOKING CONFIRMED' : 'Request sent',
            message: choice === 'dentor'
              ? 'We have received your request. Our team will revert back to you shortly.'
              : `${b.consultant} has been asked to confirm ${b.date_label} at ${b.time_label}. You will be told as soon as they answer.`,
          }),
        onError: (e) => {
          setFailure(errorMessage(e))
          void slots.refetch()
        },
      },
    )
  }

  if (step === 'case') {
    return (
      <Screen pattern testID="consult-book-case" title="Book Your Appointment" back footer={<Button testID="consult-next" label="Next" size="lg" full onPress={nextStep} />}>
        <Section title="Patient">
          {patient ? (
            <ListRow testID="consult-patient" title={patient.name} subtitle={`${patient.code} · ${patient.mobile}`} right={<T variant="smallStrong" color={colors.title}>Change</T>} onPress={() => setPicking(true)} />
          ) : (
            <Button testID="consult-choose-patient" label="Choose a patient" icon="user" variant="secondary" full onPress={() => setPicking(true)} />
          )}
          {!!errors.patient && <T variant="small" color={colors.red}>{errors.patient}</T>}
        </Section>
        <TextField testID="consult-diagnosis" label="Provisional diagnosis" value={v('diagnosis')} onChangeText={set('diagnosis')} maxLength={200} />
        <Section title="Treatment needed">
          <Row wrap gap={space.sm}>
            {TREATMENTS.map((t) => <Chip key={t} testID={`treatment-${t}`} label={t} selected={v('treatment') === t} onPress={() => set('treatment')(t)} />)}
          </Row>
          <TextField testID="consult-treatment" value={v('treatment')} onChangeText={set('treatment')} placeholder="Or write it" error={errors.treatment} maxLength={120} />
        </Section>
        <Section title="Tooth">
          <View style={styles.teeth}>
            {TEETH.map((t) => (
              <Pressable key={t} testID={`tooth-${t}`} accessibilityRole="checkbox" accessibilityState={{ checked: teeth.includes(t) }} onPress={() => toggle(teeth, setTeeth, t)}
                style={[styles.tooth, teeth.includes(t) && styles.toothOn]}>
                <Text style={[styles.toothText, teeth.includes(t) && { color: '#ffffff' }]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </Section>
        <Section title="Quadrant">
          <Row wrap gap={space.sm}>{QUADRANTS.map((q) => <Chip key={q.key} testID={`quadrant-${q.key}`} label={q.label} selected={quadrants.includes(q.key)} onPress={() => toggle(quadrants, setQuadrants, q.key)} />)}</Row>
        </Section>
        <Section title="Medical history">
          <Row wrap gap={space.sm}>{HISTORY.map((h) => <Chip key={h} label={h} selected={history.includes(h)} onPress={() => toggle(history, setHistory, h)} />)}</Row>
          <TextField testID="consult-history-note" value={v('history_note')} onChangeText={set('history_note')} placeholder="Anything else (medicines, surgeries)" maxLength={300} />
        </Section>
        <Section title="Vitals">
          <Row gap={space.sm}>
            <View style={{ flex: 1 }}><TextField testID="consult-bp" label="BP (mmHg)" value={v('bp')} onChangeText={set('bp')} placeholder="120/80" keyboardType="numbers-and-punctuation" error={errors.bp} maxLength={7} /></View>
            <View style={{ flex: 1 }}><TextField testID="consult-glucose" label="Glucose (mg/dL)" value={v('glucose')} onChangeText={set('glucose')} placeholder="110" keyboardType="decimal-pad" error={errors.glucose} maxLength={5} /></View>
          </Row>
        </Section>
        <Section title="Intra-oral images">
          <Row wrap gap={space.sm}>
            {images.map((img, i) => (
              <Pressable key={i} accessibilityLabel={`Remove ${img.name}`} onPress={() => setImages((list) => list.filter((_, j) => j !== i))}>
                <Image source={{ uri: img.dataUrl }} style={styles.thumb} />
              </Pressable>
            ))}
            {images.length < MAX_IMAGES && <Button testID="consult-attach" label="Add photo" icon="camera" variant="outline" onPress={attach} />}
          </Row>
          <T variant="tiny" color={colors.textMuted}>Up to {MAX_IMAGES} photos of 2 MB each. Tap a photo to remove it.</T>
        </Section>
        <TextField testID="consult-lab" label="Lab findings" value={v('lab')} onChangeText={set('lab')} multiline maxLength={500} />
        <TextField testID="consult-notes" label="Notes for the consultant" value={v('notes')} onChangeText={set('notes')} multiline maxLength={500} />
        <PatientPicker visible={picking} onClose={() => setPicking(false)} onPick={(p) => { setPatient(p); setPicking(false) }} />
      </Screen>
    )
  }

  const types = consultants.data?.types ?? []
  const daySlots = slots.data?.slots ?? []
  return (
    <Screen pattern testID="consult-book-choice" title="Choose a Consultant" back onBack={() => setStep('case')}
      footer={<Button testID="consult-submit" label={choice === 'dentor' ? 'Submit' : 'Book Appointment'} size="lg" full loading={send.isPending} onPress={submit} />}>
      <T variant="body">To proceed with your appointment, please choose your preferred option below.</T>
      <Segmented options={[{ key: 'own', label: 'Own choice' }, { key: 'dentor', label: 'Dentor choice' }]} value={choice} onChange={(c) => { setChoice(c); setTime('') }} />

      {choice === 'own' ? (
        <>
          <TextField testID="consult-specialty" icon="search" value={specialty} onChangeText={setSpecialty} placeholder="Speciality, e.g. Orthodontics" autoCapitalize="none" />
          {consultants.isLoading ? <SkeletonList rows={2} /> : consultants.isError ? <ErrorState error={consultants.error} onRetry={() => consultants.refetch()} /> : consultants.data?.items.length ? (
            <View style={{ gap: space.sm }}>
              {consultants.data.items.map((c) => (
                <Card key={c.id}>
                  <View style={[styles.consultant, consultantId === c.id && styles.consultantOn]}>
                    <Pressable testID={`consultant-${c.code}`} accessibilityRole="radio" accessibilityState={{ checked: consultantId === c.id }} onPress={() => { setConsultantId(c.id); setTime('') }} style={{ flex: 1 }}>
                      <T variant="bodyStrong">{c.name}</T>
                      <T variant="small" color={colors.textMuted}>{[c.specialty, c.location].filter(Boolean).join(' · ')}</T>
                      <T variant="small" color={colors.textMuted}>{[c.fee ? fmtINR(c.fee) : '', c.experience ? `${c.experience} yrs` : '', c.rating ? `${c.rating}★` : '', `${c.cases} cases`].filter(Boolean).join(' · ')}</T>
                    </Pressable>
                    <Button testID={`consultant-profile-${c.code}`} label="Profile" size="sm" variant="ghost" onPress={() => router.push({ pathname: '/consult/consultant/[id]', params: { id: c.id } })} />
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <EmptyState testID="consult-none" icon="user-x" title="No visiting consultant" message={specialty ? 'Nobody with this speciality. Clear the search or try Dentor choice.' : 'Add visiting consultants in the reception web app, or let Dentor choose.'} />
          )}
          {!!errors.consultant && <T variant="small" color={colors.red}>{errors.consultant}</T>}
          {!!consultantId && (
            <Section title="Select Date">
              <DateStrip dates={dates} value={date} today={dates[0]} onChange={(d) => { setDate(d); setTime('') }} />
              {slots.isLoading ? <SkeletonList rows={2} /> : slots.isError ? <ErrorState error={slots.error} onRetry={() => slots.refetch()} /> : daySlots.some((s) => s.available) ? (
                (['Morning', 'Afternoon', 'Evening'] as const).map((part) => {
                  const list = daySlots.filter((s) => s.part === part)
                  return list.length ? (
                    <View key={part} style={{ gap: space.xs }}>
                      <T variant="smallStrong">{part}</T>
                      <Row wrap gap={space.sm}>{list.map((s) => <Chip key={s.time} testID={`consult-slot-${s.time}`} label={s.label} selected={time === s.time} disabled={!s.available} onPress={() => setTime(s.time)} />)}</Row>
                    </View>
                  ) : null
                })
              ) : (
                <Banner tone="amber" icon="calendar" text="The consultant has no free time on this day. Choose another day." />
              )}
            </Section>
          )}
        </>
      ) : (
        <>
          {types.map((t) => (
            <Pressable key={t.key} testID={`dentor-type-${t.key}`} accessibilityRole="radio" accessibilityState={{ checked: dentorType === t.key }} onPress={() => { setDentorType(t.key); setTime('') }}
              style={[styles.type, dentorType === t.key && styles.typeOn]}>
              <Text style={styles.typeTitle}>{t.label}</Text>
              <T variant="small" color={colors.textMuted}>{t.window}</T>
              {!!t.extra && <T variant="tiny" color={colors.title}>Extra {fmtINR(t.extra)}, paid at the clinic</T>}
            </Pressable>
          ))}
          {dentorType !== 'standard' && (
            <Section title="Preferred date and time">
              <DateStrip dates={dates} value={date} today={dates[0]} onChange={(d) => { setDate(d); setTime('') }} />
              <Row wrap gap={space.sm}>
                {(dentorType === 'peak' ? PEAK : DAY_TIMES).map((t) => <Chip key={t} testID={`dentor-time-${t}`} label={fmtTime(t)} selected={time === t} onPress={() => setTime(t)} />)}
              </Row>
            </Section>
          )}
        </>
      )}
      {!!errors.time && <T variant="small" color={colors.red}>{errors.time}</T>}
      <Pressable testID="consult-declaration" accessibilityRole="checkbox" accessibilityState={{ checked: declared }} onPress={() => setDeclared((d) => !d)} style={styles.declare}>
        <View style={[styles.tick, declared && { backgroundColor: colors.header }]}>{declared && <Text style={{ color: '#ffffff', fontSize: 12 }}>✓</Text>}</View>
        <Text style={styles.declareText}>I/We declare that all instructions are legible and certify that the patient is eligible for the above said treatment.</Text>
      </Pressable>
      {!!errors.declared && <T variant="small" color={colors.red}>{errors.declared}</T>}
      {!!failure && <Banner testID="consult-error" tone="red" icon="alert-circle" text={failure} />}
      <MascotDialog
        testID="consult-sent"
        visible={!!sent}
        image={mascot}
        title={sent?.title}
        message={sent?.message}
        actions={[{ label: 'OK', testID: 'consult-sent-ok', onPress: () => sent && router.replace({ pathname: '/consult/[id]', params: { id: sent.id } }) }]}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  teeth: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tooth: { width: 38, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  toothOn: { backgroundColor: colors.header, borderColor: colors.header },
  toothText: { ...face('semibold'), fontSize: 13, color: colors.text },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.slateBg },
  consultant: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, padding: 2 },
  consultantOn: { borderWidth: 2, borderColor: colors.header, padding: 0 },
  type: { gap: 4, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  typeOn: { borderWidth: 2, borderColor: colors.header },
  typeTitle: { ...face('semibold'), fontSize: 16, color: colors.textStrong },
  declare: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  tick: { width: 20, height: 20, marginTop: 2, borderRadius: 5, borderWidth: 1.5, borderColor: colors.header, alignItems: 'center', justifyContent: 'center' },
  declareText: { ...face('regular'), fontSize: 13, lineHeight: 19, color: colors.text, flex: 1 },
})
