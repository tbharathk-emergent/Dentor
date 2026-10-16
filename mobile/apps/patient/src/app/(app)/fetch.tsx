import { api, Banner, Button, Chip, CodeInput, errorMessage, Row, Screen, T, TextField, colors, space, useSession } from '@dentor/shared'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from '@/nav'
import type { PatientSession } from '@/types'

/**
 * "FETCH" (patient-app.fig 98:1076): bring in a record registered at the clinic under another mobile number (a
 * child's, or an old number) by its patient ID. A code goes to that number; the record joins your profiles once
 * the code is entered.
 */
export default function Fetch() {
  const router = useRouter()
  const { data, signIn } = useSession<PatientSession>()
  const clinics = Array.from(new Map((data?.profiles ?? []).map((p) => [p.clinic_id, p.clinic_name])).entries())
  const [clinic, setClinic] = useState(data?.profile?.clinic_id ?? clinics[0]?.[0] ?? '')
  const [code, setCode] = useState('')
  const [otp, setOtp] = useState('')
  const [sent, setSent] = useState<null | { sent_to: string; dev_otp?: string }>(null)
  const [error, setError] = useState<string | null>(null)
  const ask = useMutation({ mutationFn: () => api.post<{ sent_to: string; dev_otp?: string }>('/api/patient/profiles/fetch', { clinic_id: clinic, patient_code: code.trim() }) })
  const verify = useMutation({ mutationFn: () => api.post('/api/patient/profiles/fetch/verify', { clinic_id: clinic, patient_code: code.trim(), code: otp }) })
  return (
    <Screen testID="fetch-screen" title="Fetch" back>
      <T>Enter the Patient ID from a card or bill of this clinic. We send a code to the mobile number registered with that record.</T>
      {clinics.length > 1 && <Row wrap gap={space.xs}>{clinics.map(([id, name]) => <Chip key={id} label={name} selected={clinic === id} onPress={() => setClinic(id)} />)}</Row>}
      <TextField testID="fetch-code" label="Patient ID" value={code} onChangeText={setCode} placeholder="e.g. DEN-1052" autoCapitalize="characters" maxLength={20} />
      {!sent ? (
        <Button testID="fetch-send" label="Fetch" size="lg" full loading={ask.isPending} onPress={() => {
          if (!code.trim()) return setError('Enter the Patient ID.')
          setError(null)
          ask.mutate(undefined, { onSuccess: setSent, onError: (e) => setError(errorMessage(e)) })
        }} />
      ) : (
        <>
          <T variant="small" color={colors.textMuted}>Enter the 6-digit code sent to {sent.sent_to}.</T>
          <CodeInput testID="fetch-otp" length={6} value={otp} onChange={setOtp} />
          {__DEV__ && !!sent.dev_otp && <Banner testID="fetch-dev-code" tone="brand" icon="info" text={`Development build: the code is ${sent.dev_otp}`} />}
          <Button testID="fetch-verify" label="Verify" size="lg" full loading={verify.isPending} onPress={() => verify.mutate(undefined, {
            onSuccess: async (payload) => { await signIn(payload); router.replace('/') },
            onError: (e) => setError(errorMessage(e)),
          })} />
        </>
      )}
      {!!error && <Banner testID="fetch-error" tone="red" icon="alert-circle" text={error} />}
    </Screen>
  )
}
