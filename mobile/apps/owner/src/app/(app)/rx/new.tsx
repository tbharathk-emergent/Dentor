import {
  Banner, Button, Card, Chip, IconButton, KeyValue, ListRow, MascotDialog, QueryState, Row, Screen, Section, Segmented, Sheet, T, TextField,
  addDays, colors, errorMessage, fmtDate, space, todayISO,
} from '@dentor/shared'
import { useMemo, useState } from 'react'
import { Share, View } from 'react-native'
import { useAddDrug, useRxCatalog, useWritePrescription, type RxMed } from '@/clinic/clinical'
import type { PatientRow } from '@/clinic/types'
import mascot from '@/assets/design/mascot-happy.png'
import { PatientPicker } from '@/components/clinic/PatientPicker'
import { useRouter } from '@/nav'

const FREQ = ['OD', 'BD', 'TDS', 'QID', 'SOS', 'HS']
const DAYS = ['1', '3', '5', '7', '10', '14']
const INSTRUCTIONS = ['After food', 'Before food', 'At bedtime', 'If pain']

/**
 * "E-prescription" (dentor.fig 261–272): the patient, individual drugs by category and type, combo drugs,
 * "Copy & Paste" from an earlier prescription, general instructions and the next appointment; then a preview,
 * share and submit. "add new medicine" (303–304) adds to the list. It reaches the patient app when submitted.
 */
export default function NewPrescription() {
  const router = useRouter()
  const catalog = useRxCatalog()
  const write = useWritePrescription()
  const [patient, setPatient] = useState<PatientRow | null>(null)
  const [picking, setPicking] = useState(false)
  const [mode, setMode] = useState<'individual' | 'combo' | 'copy'>('individual')
  const [category, setCategory] = useState('')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [meds, setMeds] = useState<RxMed[]>([])
  const [complaint, setComplaint] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [advice, setAdvice] = useState('')
  const [note, setNote] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [preview, setPreview] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const followDates = useMemo(() => [3, 7, 14, 21, 30].map((n) => addDays(todayISO(), n)), [])

  const add = (list: RxMed[]) => setMeds((m) => [...m, ...list.filter((x) => !m.some((y) => y.drug === x.drug))])
  const change = (i: number, patch: Partial<RxMed>) => setMeds((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const blank = (drug: string): RxMed => ({ drug, dose: '1 tablet', freq: 'BD', days: '5', unit: 'Days', instruction: 'After food' })

  const toPreview = () => {
    if (!patient) return setError('Choose the patient.')
    if (!meds.length) return setError('Add at least one medicine.')
    setError(null)
    setPreview(true)
  }
  const text = () =>
    [`Prescription for ${patient?.name} (${patient?.code})`, diagnosis && `Diagnosis: ${diagnosis}`,
      ...meds.map((m, i) => `${i + 1}. ${m.drug} — ${m.dose}, ${m.freq}, ${m.days} ${m.unit}, ${m.instruction}`),
      advice && `Advice: ${advice}`, followUp && `Next appointment: ${fmtDate(followUp)}`].filter(Boolean).join('\n')

  const submit = () =>
    patient &&
    write.mutate({ patient_id: patient.id, complaint: complaint.trim(), diagnosis: diagnosis.trim(), meds, advice: advice.trim(), followUp: followUp || undefined, note: note.trim() }, {
      onSuccess: (rx) => setSaved(rx.code),
      onError: (e) => { setPreview(false); setError(errorMessage(e)) },
    })

  if (preview && patient) {
    return (
      <Screen testID="rx-preview" title="E-prescription" back onBack={() => setPreview(false)}
        footer={<View style={{ gap: space.sm }}>
          <Button testID="rx-submit" label="SUBMIT" size="lg" full loading={write.isPending} onPress={submit} />
          <Button testID="rx-share" label="Share" icon="share-2" variant="ghost" full onPress={() => Share.share({ message: text() }).catch(() => undefined)} />
        </View>}>
        <Card>
          <KeyValue label="Patient" value={`${patient.name} · ${patient.code}`} />
          <KeyValue label="Complaint" value={complaint} />
          <KeyValue label="Diagnosis" value={diagnosis} />
        </Card>
        {meds.map((m, i) => <ListRow key={i} title={`${i + 1}. ${m.drug}`} subtitle={`${m.dose} · ${m.freq} · ${m.days} ${m.unit} · ${m.instruction}`} />)}
        <Card>
          <KeyValue label="General instructions" value={advice} />
          <KeyValue label="Next appointment" value={followUp ? fmtDate(followUp) : ''} />
          <KeyValue label="Notes" value={note} />
        </Card>
        <MascotDialog testID="rx-saved" visible={!!saved} image={mascot} title="Prescription saved" message={`${saved} is signed and has reached ${patient.name}'s patient app.`}
          actions={[{ label: 'OK', testID: 'rx-saved-ok', onPress: () => router.back() }]} />
      </Screen>
    )
  }

  return (
    <Screen testID="rx-screen" title="E-prescription" back footer={<Button testID="rx-preview-open" label="Preview" size="lg" full onPress={toPreview} />}>
      <Section title="Patient">
        {patient ? <ListRow testID="rx-patient" title={patient.name} subtitle={`${patient.code} · ${patient.gender} ${patient.age ? `· ${patient.age} yrs` : ''}`} right={<T variant="smallStrong" color={colors.title}>Change</T>} onPress={() => setPicking(true)} />
          : <Button testID="rx-choose-patient" label="Choose a patient" icon="user" variant="secondary" full onPress={() => setPicking(true)} />}
      </Section>
      <TextField testID="rx-complaint" label="Chief complaint" value={complaint} onChangeText={setComplaint} maxLength={200} />
      <TextField testID="rx-diagnosis" label="Diagnosis" value={diagnosis} onChangeText={setDiagnosis} maxLength={200} />

      <Section title="Choose Prescription" action="Add medicine" onAction={() => setAdding(true)}>
        <Segmented options={[{ key: 'individual', label: 'Individual' }, { key: 'combo', label: 'Combo' }, { key: 'copy', label: 'Copy & Paste' }]} value={mode} onChange={setMode} />
        <QueryState query={catalog}>
          {(c) => mode === 'individual' ? (
            <>
              <Row wrap gap={space.xs}>{['', ...c.categories].map((x) => <Chip key={x || 'all'} label={x || 'All categories'} selected={category === x} onPress={() => setCategory(x)} />)}</Row>
              <Row wrap gap={space.xs}>{['', ...c.types].map((x) => <Chip key={x || 'all'} label={x || 'All types'} selected={type === x} onPress={() => setType(x)} />)}</Row>
              <TextField testID="rx-drug-search" icon="search" value={q} onChangeText={setQ} placeholder="Search drugs" autoCapitalize="none" />
              {c.drugs.filter((d) => (!category || d.category === category) && (!type || d.type === type) && (!q || d.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 12).map((d) => (
                <ListRow key={d.id} testID={`drug-${d.name}`} title={d.name} subtitle={[d.category, d.type, d.dosage].filter(Boolean).join(' · ')}
                  right={<T variant="smallStrong" color={meds.some((m) => m.drug === d.name) ? colors.green : colors.title}>{meds.some((m) => m.drug === d.name) ? 'Added' : 'Add'}</T>}
                  onPress={() => add([blank(d.name)])} />
              ))}
            </>
          ) : mode === 'combo' ? (
            c.combos.length ? c.combos.map((x) => <ListRow key={x.id} testID={`combo-${x.name}`} title={x.name} subtitle={x.meds.map((m) => m.drug).join(' + ')} right={<T variant="smallStrong" color={colors.title}>Add all</T>} onPress={() => add(x.meds)} />)
              : <T variant="small" color={colors.textMuted}>No combos saved yet. The reception web app keeps them.</T>
          ) : (
            c.recent.map((x) => <ListRow key={x.id} testID={`copy-${x.code}`} title={`${x.patient} · ${x.code}`} subtitle={x.meds.map((m) => m.drug).join(' + ')} meta={fmtDate(x.date)} right={<T variant="smallStrong" color={colors.title}>Copy</T>} onPress={() => add(x.meds)} />)
          )}
        </QueryState>
      </Section>

      {meds.length > 0 && (
        <Section title={`Added (${meds.length})`}>
          {meds.map((m, i) => (
            <Card key={m.drug}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T variant="bodyStrong" style={{ flex: 1 }}>{m.drug}</T>
                <IconButton testID={`remove-${m.drug}`} icon="x" label={`Remove ${m.drug}`} onPress={() => setMeds((list) => list.filter((_, j) => j !== i))} />
              </View>
              <TextField label="Dose" value={m.dose} onChangeText={(v) => change(i, { dose: v })} maxLength={40} />
              <Row wrap gap={space.xs}>{FREQ.map((f) => <Chip key={f} label={f} selected={m.freq === f} onPress={() => change(i, { freq: f })} />)}</Row>
              <Row wrap gap={space.xs}>{DAYS.map((d) => <Chip key={d} label={`${d} days`} selected={m.days === d} onPress={() => change(i, { days: d })} />)}</Row>
              <Row wrap gap={space.xs}>{INSTRUCTIONS.map((x) => <Chip key={x} label={x} selected={m.instruction === x} onPress={() => change(i, { instruction: x })} />)}</Row>
            </Card>
          ))}
        </Section>
      )}

      <TextField testID="rx-advice" label="General Instructions" value={advice} onChangeText={setAdvice} multiline maxLength={500} />
      <Section title="Next Appointment">
        <Row wrap gap={space.xs}>
          <Chip label="None" selected={!followUp} onPress={() => setFollowUp('')} />
          {followDates.map((d) => <Chip key={d} label={fmtDate(d)} selected={followUp === d} onPress={() => setFollowUp(d)} />)}
        </Row>
      </Section>
      <TextField testID="rx-note" label="Notes" value={note} onChangeText={setNote} multiline maxLength={500} />
      {!!error && <Banner testID="rx-error" tone="red" icon="alert-circle" text={error} />}
      <PatientPicker visible={picking} onClose={() => setPicking(false)} onPick={(p) => { setPatient(p); setPicking(false) }} />
      <AddMedicine visible={adding} categories={catalog.data?.categories ?? []} types={catalog.data?.types ?? []} onClose={() => setAdding(false)} onAdded={(name) => { setAdding(false); add([blank(name)]) }} />
    </Screen>
  )
}

function AddMedicine({ visible, categories, types, onClose, onAdded }: { visible: boolean; categories: string[]; types: string[]; onClose: () => void; onAdded: (name: string) => void }) {
  const save = useAddDrug()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [type, setType] = useState('')
  const [dosage, setDosage] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet testID="add-medicine" visible={visible} onClose={onClose} title="Add new medicine"
      footer={<Button testID="medicine-save" label="Save Medicine" size="lg" full loading={save.isPending} onPress={() => {
        if (name.trim().length < 2 || !category.trim() || !type) return setError('Give the name, category and type.')
        save.mutate({ name: name.trim(), category: category.trim(), type, dosage: dosage.trim() }, { onSuccess: (d) => { setName(''); setDosage(''); setError(null); onAdded(d.name) }, onError: (e) => setError(errorMessage(e)) })
      }} />}>
      <TextField testID="medicine-name" label="Drug" value={name} onChangeText={setName} maxLength={80} />
      <TextField testID="medicine-category" label="Drug Category" value={category} onChangeText={setCategory} maxLength={40} hint={categories.length ? `For example ${categories.slice(0, 3).join(', ')}` : undefined} />
      <T variant="smallStrong">Drug Type</T>
      <Row wrap gap={space.xs}>{types.map((t) => <Chip key={t} testID={`medicine-type-${t}`} label={t} selected={type === t} onPress={() => setType(t)} />)}</Row>
      <TextField testID="medicine-dosage" label="Drug Dosage" value={dosage} onChangeText={setDosage} maxLength={40} />
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
    </Sheet>
  )
}
