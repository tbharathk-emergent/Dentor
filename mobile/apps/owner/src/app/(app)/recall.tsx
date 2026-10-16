import { Banner, Button, Chip, ErrorState, ListRow, MascotDialog, QueryState, Row, Screen, Section, Sheet, T, TextField, addDays, colors, errorMessage, space, todayISO } from '@dentor/shared'
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { useRecallTemplates, useSaveTemplate, useSendRecall, type RecallTemplate } from '@/clinic/clinical'
import type { PatientRow } from '@/clinic/types'
import mascot from '@/assets/design/mascot-happy.png'
import { PatientPicker } from '@/components/clinic/PatientPicker'

/**
 * "Recall" (dentor.fig 152–158): choose a patient and a template, edit the message, pick when it is due and
 * send; manage templates (up to 160 characters). The reminder reaches the patient app; SMS and WhatsApp are
 * excluded, so a patient without the app is reported back to call instead.
 */
export default function Recall() {
  const templates = useRecallTemplates()
  const send = useSendRecall()
  const dates = useMemo(() => Array.from({ length: 8 }, (_, i) => addDays(todayISO(), i * 7)), [])
  const [patient, setPatient] = useState<PatientRow | null>(null)
  const [picking, setPicking] = useState(false)
  const [template, setTemplate] = useState<RecallTemplate | null>(null)
  const [message, setMessage] = useState('')
  const [due, setDue] = useState('')
  const [editing, setEditing] = useState<RecallTemplate | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<null | { delivered: boolean; patient: string; mobile: string; message: string }>(null)

  const choose = (t: RecallTemplate) => {
    setTemplate(t)
    setMessage(t.text)
  }
  const submit = () => {
    if (!patient) return setError('Select the patient.')
    if (message.trim().length < 10) return setError('Write the message.')
    setError(null)
    send.mutate({ patient_id: patient.id, message: message.trim(), due: due || undefined, template_id: template?.id }, { onSuccess: setResult, onError: (e) => setError(errorMessage(e)) })
  }

  return (
    <Screen testID="recall-screen" title="Recall" back footer={<Button testID="recall-send" label="Send" size="lg" full loading={send.isPending} onPress={submit} />}>
      <Section title="Select Patient">
        {patient ? <ListRow testID="recall-patient" title={patient.name} subtitle={`${patient.code} · ${patient.mobile}`} right={<T variant="smallStrong" color={colors.title}>Change</T>} onPress={() => setPicking(true)} />
          : <Button testID="recall-choose-patient" label="Select patient" icon="user" variant="secondary" full onPress={() => setPicking(true)} />}
      </Section>
      <Section title="Message Templates" action="New" onAction={() => setEditing('new')}>
        <QueryState query={templates}>
          {(data) => (
            <View style={{ gap: space.xs }}>
              {data.items.map((t) => (
                <ListRow key={t.id} testID={`template-${t.name}`} title={t.name} subtitle={t.text} right={<T variant="smallStrong" color={template?.id === t.id ? colors.green : colors.title}>{template?.id === t.id ? 'Selected' : 'Use'}</T>}
                  onPress={() => choose(t)} />
              ))}
              {template && <Button testID="template-edit" label={`Edit "${template.name}"`} variant="ghost" size="sm" onPress={() => setEditing(template)} />}
            </View>
          )}
        </QueryState>
      </Section>
      <TextField testID="recall-message" label="Message Content" value={message} onChangeText={setMessage} multiline maxLength={500}
        hint="[Patient Name] and [Clinic Name] are filled in when it is sent." />
      <Section title="Due">
        <Row wrap gap={space.xs}>
          <Chip label="No date" selected={!due} onPress={() => setDue('')} />
          {dates.slice(1).map((d) => <Chip key={d} label={d.slice(5).split('-').reverse().join('/')} selected={due === d} onPress={() => setDue(d)} />)}
        </Row>
      </Section>
      <Banner tone="blue" icon="info" text="Recalls reach the patient app. Text messages and WhatsApp are not sent from Dentor." />
      {!!error && <Banner testID="recall-error" tone="red" icon="alert-circle" text={error} />}
      <PatientPicker visible={picking} onClose={() => setPicking(false)} onPick={(p) => { setPatient(p); setPicking(false) }} />
      <TemplateSheet editing={editing} onClose={() => setEditing(null)} onSaved={(t) => { setEditing(null); choose(t) }} />
      <MascotDialog
        testID="recall-done"
        visible={!!result}
        image={mascot}
        tone={result?.delivered ? 'brand' : 'danger'}
        title={result?.delivered ? 'Recall sent' : 'Not sent'}
        message={result ? (result.delivered ? `You have successfully sent the recall message to ${result.patient}.` : `${result.patient} does not use the Dentor patient app. Please call ${result.mobile}.`) : ''}
        actions={[{ label: 'OK', testID: 'recall-done-ok', onPress: () => { setResult(null); setPatient(null) } }]}
      />
    </Screen>
  )
}

function TemplateSheet({ editing, onClose, onSaved }: { editing: RecallTemplate | 'new' | null; onClose: () => void; onSaved: (t: RecallTemplate) => void }) {
  const save = useSaveTemplate()
  const current = editing && editing !== 'new' ? editing : null
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const key = current?.id ?? (editing ? 'new' : '')
  const [loaded, setLoaded] = useState('')
  if (key !== loaded) {
    setLoaded(key)
    setName(current?.name ?? '')
    setText(current?.text ?? '')
    setError(null)
  }
  return (
    <Sheet testID="template-sheet" visible={!!editing} onClose={onClose} title={current ? 'Edit Template' : 'Create Template'}
      footer={<Button testID="template-save" label={current ? 'Update' : 'Create Template'} size="lg" full loading={save.isPending} onPress={() =>
        save.mutate({ id: current?.id, name: name.trim(), text: text.trim() }, { onSuccess: onSaved, onError: (e) => setError(errorMessage(e)) })} />}>
      <TextField testID="template-name" label="Template Name" value={name} onChangeText={setName} maxLength={60} />
      <TextField testID="template-text" label="Message Content" value={text} onChangeText={setText} multiline maxLength={160} hint={`${text.length}/160`} />
      {!!error && <ErrorState error={new Error(error)} />}
    </Sheet>
  )
}
