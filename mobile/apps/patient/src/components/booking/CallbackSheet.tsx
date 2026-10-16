import { api, Banner, Button, Chip, errorMessage, Row, Sheet, TextField, space, useToast } from '@dentor/shared'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

const WHEN = ['As soon as possible', 'This morning', 'This afternoon', 'After 5 pm']

/** "Request Callback" (patient-app.fig "SCHEDULER" 18:163): the clinic's front desk is asked to call. */
export function CallbackSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast()
  const [when, setWhen] = useState(WHEN[0])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ask = useMutation({ mutationFn: () => api.post('/api/patient/callback', { when, note: note.trim() }) })
  return (
    <Sheet testID="callback-sheet" visible={visible} onClose={onClose} title="Request Callback" subtitle="The clinic will call your registered number"
      footer={<Button testID="callback-send" label="Request Callback" size="lg" full loading={ask.isPending} onPress={() => ask.mutate(undefined, {
        onSuccess: () => { setNote(''); setError(null); onClose(); toast.success('The clinic will call you back.') },
        onError: (e) => setError(errorMessage(e)),
      })} />}>
      <Row wrap gap={space.xs}>{WHEN.map((w) => <Chip key={w} label={w} selected={when === w} onPress={() => setWhen(w)} />)}</Row>
      <TextField testID="callback-note" label="What is it about? (optional)" value={note} onChangeText={setNote} maxLength={300} />
      {!!error && <Banner testID="callback-error" tone="red" icon="alert-circle" text={error} />}
    </Sheet>
  )
}
