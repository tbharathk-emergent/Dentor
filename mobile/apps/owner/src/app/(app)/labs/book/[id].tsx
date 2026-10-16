import {
  Banner, Button, Card, Chip, KeyValue, ListRow, MascotDialog, QueryState, Row, Screen, Section, T, TextField,
  colors, errorMessage, face, space, useLocalSearchParams,
} from '@dentor/shared'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useBookLab, useLab, useLabs, type Lab, type LabOptions } from '@/clinic/clinical'
import { TEETH } from '@/clinic/consult'
import type { PatientRow } from '@/clinic/types'
import mascot from '@/assets/design/mascot-happy.png'
import { PatientPicker } from '@/components/clinic/PatientPicker'
import { useRouter } from '@/nav'

const SHADES = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'D2', 'D3', 'BL1', 'BL2']
const STUMP = ['ND1', 'ND2', 'ND3', 'ND4', 'ND5', 'ND6', 'ND7', 'ND8', 'ND9']
const GUIDES = ['VITA Classical', 'VITA 3D Master', 'Bleach Shades']

/**
 * "Book a Service" for one lab: blood tests with home or lab collection (dentor.fig 166–167), X-ray type and
 * teeth (176–177), dental lab work with shades (168–170, 189–191) or a CBCT referral (172–175); then a
 * preview and "sent successfully" (178). The declaration is required.
 */
export default function BookLab() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const lab = useLab(id)
  const all = useLabs()
  return (
    <Screen pattern testID="lab-book-screen" title="Book a Service" back>
      <QueryState query={lab}>{(l) => (all.data ? <Form lab={l} options={all.data.options} /> : null)}</QueryState>
    </Screen>
  )
}

function Form({ lab, options }: { lab: Lab; options: LabOptions }) {
  const router = useRouter()
  const book = useBookLab()
  const [patient, setPatient] = useState<PatientRow | null>(null)
  const [picking, setPicking] = useState(false)
  const [d, setD] = useState<Record<string, any>>({ tests: [], teeth: [], indications: [] })
  const [notes, setNotes] = useState('')
  const [declared, setDeclared] = useState(false)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const set = (k: string, v: unknown) => setD((x) => ({ ...x, [k]: v }))
  const toggle = (k: string, v: string) => setD((x) => ({ ...x, [k]: (x[k] as string[]).includes(v) ? (x[k] as string[]).filter((y) => y !== v) : [...(x[k] as string[]), v] }))

  const problem = (): string | null => {
    if (!patient) return 'Choose the patient.'
    if (lab.type === 'Blood' && (!d.tests.length || !d.collection)) return 'Choose the tests and home visit or lab.'
    if (lab.type === 'X-ray' && (!d.xray_type || (['IOPA', 'Bitewing'].includes(d.xray_type) && !d.teeth.length))) return 'Choose the X-ray type and the teeth.'
    if (lab.type === 'Dental' && (!d.work || !d.teeth.length)) return 'Choose the work and the teeth.'
    if (lab.type === 'CBCT' && (!d.indications.length || !d.region || !d.fov)) return 'Tick the indications and choose the region and field of view.'
    if (lab.type === 'CBCT' && !d.consent) return "The patient's consent to the CBCT scan is required."
    if (!declared) return 'Confirm the declaration to send the request.'
    return null
  }

  const toPreview = () => {
    const p = problem()
    setError(p)
    if (!p) setPreview(true)
  }

  const submit = () =>
    patient &&
    book.mutate({ patient_id: patient.id, lab_id: lab.id, details: d, notes: notes.trim(), declaration: declared }, {
      onSuccess: () => setSent(true),
      onError: (e) => { setPreview(false); setError(errorMessage(e)) },
    })

  const teethGrid = (
    <View style={styles.teeth}>
      {TEETH.map((t) => (
        <Pressable key={t} testID={`lab-tooth-${t}`} accessibilityRole="checkbox" accessibilityState={{ checked: d.teeth.includes(t) }} onPress={() => toggle('teeth', t)}
          style={[styles.tooth, d.teeth.includes(t) && styles.toothOn]}>
          <Text style={[styles.toothText, d.teeth.includes(t) && { color: '#ffffff' }]}>{t}</Text>
        </Pressable>
      ))}
    </View>
  )

  if (preview && patient) {
    return (
      <>
        <T variant="h3">PREVIEW</T>
        <Card>
          <KeyValue label="Lab" value={lab.name} />
          <KeyValue label="Patient" value={`${patient.name} · ${patient.code}`} />
          <KeyValue label="Mobile" value={patient.mobile} />
          {Object.entries(d).filter(([, v]) => (Array.isArray(v) ? v.length : v)).map(([k, v]) => (
            <KeyValue key={k} label={k.replace(/_/g, ' ')} value={Array.isArray(v) ? v.join(', ') : v === true ? 'Yes' : String(v)} />
          ))}
          <KeyValue label="Notes" value={notes} />
        </Card>
        <Button testID="lab-submit" label="SUBMIT" size="lg" full loading={book.isPending} onPress={submit} />
        <Button label="Edit" variant="ghost" full onPress={() => setPreview(false)} />
        <MascotDialog testID="lab-sent" visible={sent} image={mascot} title="Sent"
          message={`Your request form to ${lab.name} was sent successfully.`}
          actions={[{ label: 'Home', testID: 'lab-sent-ok', onPress: () => router.replace('/labs/orders') }]} />
      </>
    )
  }

  return (
    <>
      <Banner tone="brand" icon="info" text={`${lab.name} · ${lab.type} lab`} />
      <Section title="Patient">
        {patient ? (
          <ListRow testID="lab-patient" title={patient.name} subtitle={`${patient.code} · ${patient.mobile}`} right={<T variant="smallStrong" color={colors.title}>Change</T>} onPress={() => setPicking(true)} />
        ) : (
          <Button testID="lab-choose-patient" label="Choose a patient" icon="user" variant="secondary" full onPress={() => setPicking(true)} />
        )}
      </Section>

      {lab.type === 'Blood' && (
        <>
          <Section title="Test Type"><Row wrap gap={space.sm}>{options.blood_tests.map((t) => <Chip key={t} testID={`test-${t}`} label={t} selected={d.tests.includes(t)} onPress={() => toggle('tests', t)} />)}</Row></Section>
          <Section title="Collection Type"><Row gap={space.sm}>{['Home Visit', 'Lab'].map((c) => <Chip key={c} testID={`collection-${c}`} label={c} selected={d.collection === c} onPress={() => set('collection', c)} />)}</Row></Section>
        </>
      )}

      {lab.type === 'X-ray' && (
        <>
          <Section title="X-Ray Type"><Row wrap gap={space.sm}>{options.xray_types.map((t) => <Chip key={t} testID={`xray-${t}`} label={t} selected={d.xray_type === t} onPress={() => set('xray_type', t)} />)}</Row></Section>
          <Section title="Select Tooth">{teethGrid}</Section>
          <TextField testID="xray-reason" label="Clinical Reason" value={d.reason ?? ''} onChangeText={(v) => set('reason', v)} maxLength={200} />
        </>
      )}

      {lab.type === 'Dental' && (
        <>
          <Section title="Work"><Row wrap gap={space.sm}>{options.dental_work.map((w) => <Chip key={w} testID={`work-${w}`} label={w} selected={d.work === w} onPress={() => set('work', w)} />)}</Row></Section>
          <Section title="Tooth selection">{teethGrid}</Section>
          <TextField testID="dental-material" label="Material" value={d.material ?? ''} onChangeText={(v) => set('material', v)} placeholder="e.g. Zirconia, E-max, PFM" maxLength={60} />
          <Section title="Shade Guide"><Row wrap gap={space.sm}>{GUIDES.map((g) => <Chip key={g} label={g} selected={d.shade_guide === g} onPress={() => set('shade_guide', g)} />)}</Row></Section>
          <Section title="Primary Shade"><Row wrap gap={space.xs}>{SHADES.map((s) => <Chip key={s} testID={`shade-${s}`} label={s} selected={d.primary_shade === s} onPress={() => set('primary_shade', s)} />)}</Row></Section>
          <Section title="Stump Shade"><Row wrap gap={space.xs}>{STUMP.map((s) => <Chip key={s} label={s} selected={d.stump_shade === s} onPress={() => set('stump_shade', s)} />)}</Row></Section>
          <TextField label="Cervical shade" value={d.cervical_shade ?? ''} onChangeText={(v) => set('cervical_shade', v)} maxLength={10} />
          <TextField label="Pontic design" value={d.pontic_design ?? ''} onChangeText={(v) => set('pontic_design', v)} maxLength={40} />
          <TextField label="Margin design" value={d.margin_design ?? ''} onChangeText={(v) => set('margin_design', v)} maxLength={40} />
          {String(d.work ?? '').startsWith('Implant') && (
            <>
              <TextField label="Implant system" value={d.implant_system ?? ''} onChangeText={(v) => set('implant_system', v)} maxLength={60} />
              <TextField label="Abutment type" value={d.abutment ?? ''} onChangeText={(v) => set('abutment', v)} maxLength={60} />
            </>
          )}
        </>
      )}

      {lab.type === 'CBCT' && (
        <>
          <Section title="Clinical Indications"><Row wrap gap={space.sm}>{options.cbct_indications.map((t) => <Chip key={t} testID={`indication-${t}`} label={t} selected={d.indications.includes(t)} onPress={() => toggle('indications', t)} />)}</Row></Section>
          <Section title="Region of interest"><Row wrap gap={space.sm}>{['Maxilla', 'Mandible', 'Full Maxillofacial'].map((r) => <Chip key={r} testID={`region-${r}`} label={r} selected={d.region === r} onPress={() => set('region', r)} />)}</Row></Section>
          <Section title="Field of view"><Row wrap gap={space.sm}>{options.fov.map((f) => <Chip key={f} testID={`fov-${f}`} label={f} selected={d.fov === f} onPress={() => set('fov', f)} />)}</Row></Section>
          <Pressable testID="cbct-consent" accessibilityRole="checkbox" accessibilityState={{ checked: !!d.consent }} onPress={() => set('consent', !d.consent)} style={styles.declare}>
            <View style={[styles.tick, d.consent && { backgroundColor: colors.header }]}>{d.consent && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}</View>
            <Text style={styles.declareText}>The patient gives informed consent to undergo the CBCT (Cone Beam Computed Tomography) scan.</Text>
          </Pressable>
        </>
      )}

      <TextField testID="lab-notes" label="Notes" value={notes} onChangeText={setNotes} multiline maxLength={500} />
      <Pressable testID="lab-declaration" accessibilityRole="checkbox" accessibilityState={{ checked: declared }} onPress={() => setDeclared((x) => !x)} style={styles.declare}>
        <View style={[styles.tick, declared && { backgroundColor: colors.header }]}>{declared && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}</View>
        <Text style={styles.declareText}>We declare that all instructions are legible and certify that the patient is eligible for the above said treatment.</Text>
      </Pressable>
      {!!error && <Banner testID="lab-error" tone="red" icon="alert-circle" text={error} />}
      <Button testID="lab-preview" label="Preview" size="lg" full onPress={toPreview} />
      <PatientPicker visible={picking} onClose={() => setPicking(false)} onPick={(p) => { setPatient(p); setPicking(false) }} />
    </>
  )
}

const styles = StyleSheet.create({
  teeth: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tooth: { width: 38, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  toothOn: { backgroundColor: colors.header, borderColor: colors.header },
  toothText: { ...face('semibold'), fontSize: 13, color: colors.text },
  declare: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  tick: { width: 20, height: 20, marginTop: 2, borderRadius: 5, borderWidth: 1.5, borderColor: colors.header, alignItems: 'center', justifyContent: 'center' },
  declareText: { ...face('regular'), fontSize: 13, lineHeight: 19, color: colors.text, flex: 1 },
})
