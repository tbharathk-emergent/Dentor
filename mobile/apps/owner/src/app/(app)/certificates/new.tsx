import { Banner, Button, Chip, ListRow, Row, Screen, Section, T, TextField, colors, errorMessage, space, useLocalSearchParams } from '@dentor/shared'
import { useState } from 'react'
import { useIssueCertificate } from '@/clinic/clinical'
import type { PatientRow } from '@/clinic/types'
import { PatientPicker } from '@/components/clinic/PatientPicker'
import { useRouter } from '@/nav'

const EXAMS = ['Oral examination', 'Dental check-up', 'Pre-operative assessment']
const FITNESS = ['Fit for general anaesthesia', 'Fit for dental treatment', 'Fit to resume work', 'Not fit at present']
const SPECIALISTS = ['ENT Specialist', 'Cardiologist', 'Physician', 'Oral & Maxillofacial Surgeon', 'Orthodontist', 'Radiologist']
const MARITAL = ['Single', 'Married', 'Other']

/** "fitness certificate" (dentor.fig 320) and "referral certificate" (322–323); "Generate" opens the preview. */
export default function NewCertificate() {
  const { type } = useLocalSearchParams<{ type: 'Fitness' | 'Referral' }>()
  const router = useRouter()
  const issue = useIssueCertificate()
  const [patient, setPatient] = useState<PatientRow | null>(null)
  const [picking, setPicking] = useState(false)
  const [f, setF] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }))
  const fitness = type !== 'Referral'

  const submit = () => {
    if (!patient) return setError('Choose the patient.')
    issue.mutate({ ...f, patient_id: patient.id, type: fitness ? 'Fitness' : 'Referral' }, {
      onSuccess: (c) => router.replace({ pathname: '/certificates/[id]', params: { id: c.id } }),
      onError: (e) => setError(errorMessage(e)),
    })
  }

  return (
    <Screen testID="certificate-new-screen" title={fitness ? 'Fitness Certificate' : 'Referral Certificate'} back
      footer={<Button testID="certificate-generate" label="Generate" size="lg" full loading={issue.isPending} onPress={submit} />}>
      <Section title="Patient Details">
        {patient ? <ListRow testID="certificate-patient" title={patient.name} subtitle={`${patient.code} · ${patient.gender} ${patient.age ? `· ${patient.age} yrs` : ''}`} right={<T variant="smallStrong" color={colors.title}>Change</T>} onPress={() => setPicking(true)} />
          : <Button testID="certificate-choose-patient" label="Choose a patient" icon="user" variant="secondary" full onPress={() => setPicking(true)} />}
        <T variant="tiny" color={colors.textMuted}>Name, age, sex and address are filled in from the patient record.</T>
      </Section>
      {fitness ? (
        <>
          <T variant="smallStrong">Marital status</T>
          <Row wrap gap={space.xs}>{MARITAL.map((m) => <Chip key={m} label={m} selected={f.marital_status === m} onPress={() => set('marital_status')(m)} />)}</Row>
          <T variant="smallStrong">Select Examination</T>
          <Row wrap gap={space.xs}>{EXAMS.map((m) => <Chip key={m} label={m} selected={f.examination === m} onPress={() => set('examination')(m)} />)}</Row>
          <TextField testID="certificate-findings" label="Findings" required value={f.findings ?? ''} onChangeText={set('findings')} placeholder="Good oral hygiene, no caries" multiline maxLength={500} />
          <T variant="smallStrong">Select Fitness</T>
          <Row wrap gap={space.xs}>{FITNESS.map((m) => <Chip key={m} testID={`fitness-${m}`} label={m} selected={f.fitness === m} onPress={() => set('fitness')(m)} />)}</Row>
          <TextField testID="certificate-remarks" label="Remarks" value={f.remarks ?? ''} onChangeText={set('remarks')} multiline maxLength={500} />
        </>
      ) : (
        <>
          <T variant="smallStrong">Specialist</T>
          <Row wrap gap={space.xs}>{SPECIALISTS.map((m) => <Chip key={m} testID={`specialist-${m}`} label={m} selected={f.specialist === m} onPress={() => set('specialist')(m)} />)}</Row>
          <TextField testID="certificate-reason" label="Reason for Referral" required value={f.reason ?? ''} onChangeText={set('reason')} multiline maxLength={300} />
          <TextField testID="certificate-findings" label="Clinical Findings" value={f.findings ?? ''} onChangeText={set('findings')} multiline maxLength={500} />
          <TextField testID="certificate-investigations" label="Investigations" value={f.investigations ?? ''} onChangeText={set('investigations')} multiline maxLength={300} />
        </>
      )}
      {!!error && <Banner testID="certificate-error" tone="red" icon="alert-circle" text={error} />}
      <PatientPicker visible={picking} onClose={() => setPicking(false)} onPick={(p) => { setPatient(p); setPicking(false) }} />
    </Screen>
  )
}
