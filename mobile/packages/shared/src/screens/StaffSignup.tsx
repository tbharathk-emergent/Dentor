import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api, errorMessage } from '../api'
import { useRouter } from '../navigation'
import { pickImage, type PickedFile } from '../pickers'
import { colors, face, space } from '../theme'
import { EMAIL_PATTERN, STRONG_PASSWORD_RULE, mobileProblem, normalizeMobile, strongPasswordProblem } from '../validation'
import { CodeInput } from '../ui/codeInput'
import { Screen } from '../ui/layout'
import { MascotDialog } from '../ui/mascot'
import { Banner, Button, Icon, TextField } from '../ui/primitives'
import { useCountdown } from './StaffForgot'

type Kind = 'clinic' | 'consultant'
type Step = 'email' | 'code' | 'kyc' | 'academic' | 'address' | 'finish'
const STAGES: { key: Step; label: string }[] = [
  { key: 'kyc', label: 'KYC' },
  { key: 'academic', label: 'Academic' },
  { key: 'address', label: 'Address' },
  { key: 'finish', label: 'Finish' },
]
const MAX_FILE_BYTES = 2 * 1024 * 1024

/**
 * "Sign Up" for a clinic (Clinic app) or a consultant (Consultant app), as dentor.fig draws it:
 * email and a 4-digit code, then KYC, Academic, Address and Finish. The application waits for
 * Dentor's approval; signing in before then says so. Only the last four Aadhaar digits are kept.
 */
export function StaffSignupScreen({ kind, mascot }: { kind: Kind; mascot: number | string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [ticket, setTicket] = useState('')
  const [form, setForm] = useState<Record<string, string>>({ country: 'India' })
  const [aadhaar, setAadhaar] = useState('')
  const [files, setFiles] = useState<Record<string, PickedFile | undefined>>({})
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [wait, setWait] = useCountdown()
  const clinic = kind === 'clinic'
  const toLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'))
  const set = (key: string) => (value: string) => setForm((f) => ({ ...f, [key]: value }))
  const value = (key: string) => form[key] ?? ''

  const run = async (work: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      await work()
    } catch (err) {
      setFailure(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const go = (next: Step, found: Record<string, string | undefined>) => {
    setErrors(found)
    setFailure(null)
    if (Object.values(found).some(Boolean)) return
    setStep(next)
  }

  const sendCode = () => {
    const problem = EMAIL_PATTERN.test(email.trim()) ? undefined : 'Enter a valid email address, like name@example.com.'
    setErrors({ email: problem })
    if (problem) return
    void run(async () => {
      const res = await api.public.post('/api/auth/signup/email', { email: email.trim().toLowerCase() })
      setDevCode(res.dev_code ?? null)
      setWait(res.resend_in ?? 30)
      setCode('')
      setStep('code')
    })
  }

  const verify = () => {
    const problem = code.length === 4 ? undefined : 'Enter the 4-digit code.'
    setErrors({ code: problem })
    if (problem) return
    void run(async () => {
      const res = await api.public.post('/api/auth/signup/verify', { email: email.trim().toLowerCase(), code })
      setTicket(res.ticket)
      setStep('kyc')
    })
  }

  const attach = (key: string) => {
    void run(async () => {
      const file = await pickImage()
      if (!file) return
      if (file.size > MAX_FILE_BYTES) throw new Error('Choose a photo of up to 2 MB.')
      setFiles((f) => ({ ...f, [key]: file }))
    })
  }

  const kycNext = () => {
    const digits = aadhaar.replace(/\D/g, '')
    go('academic', {
      name: value('name').trim().length < 2 ? 'Enter your full name.' : undefined,
      dob: value('dob') && !/^\d{4}-\d{2}-\d{2}$/.test(value('dob')) ? 'Use the form yyyy-mm-dd, like 1990-02-01.' : undefined,
      mobile: mobileProblem(value('mobile')),
      alternate_mobile: mobileProblem(value('alternate_mobile'), { required: false }),
      aadhaar: digits && digits.length !== 12 ? 'An Aadhaar number has 12 digits.' : undefined,
      clinic_name: clinic && value('clinic_name').trim().length < 2 ? "Enter the clinic's name." : undefined,
    })
  }

  const academicNext = () => {
    go('address', {
      institution: value('institution').trim() ? undefined : 'Enter where you studied.',
      graduation_year: /^(19|20)\d{2}$/.test(value('graduation_year')) ? undefined : 'Enter the year, like 2014.',
      dci_number: value('dci_number').trim() ? undefined : 'Enter your Dental Council registration number.',
    })
  }

  const addressNext = () => {
    go('finish', {
      area: value('area').trim() ? undefined : 'Enter the area.',
      city: value('city').trim() ? undefined : 'Enter the city.',
      state: value('state').trim() ? undefined : 'Enter the state.',
      pincode: /^\d{6}$/.test(value('pincode')) ? undefined : 'A PIN code has 6 digits.',
    })
  }

  const submit = () => {
    const found = {
      password: strongPasswordProblem(password),
      confirm: confirm === password ? undefined : 'The two passwords do not match.',
      agreed: agreed ? undefined : 'Accept the terms and conditions to continue.',
    }
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
    void run(async () => {
      const profile: Record<string, string> = { ...form, mobile: normalizeMobile(value('mobile')) }
      if (value('alternate_mobile')) profile.alternate_mobile = normalizeMobile(value('alternate_mobile'))
      for (const [key, file] of Object.entries(files)) if (file) profile[key] = file.dataUrl
      await api.public.post('/api/auth/signup', { ticket, kind, password, aadhaar, profile, agreed })
      setDone(true)
    })
  }

  const problem = !!failure && <Banner testID="signup-error" tone="red" icon="alert-circle" text={failure} />
  const field = (key: string, label: string, options: Partial<Parameters<typeof TextField>[0]> = {}) => (
    <TextField testID={`signup-${key}`} label={label} value={value(key)} onChangeText={set(key)} error={errors[key]} {...options} />
  )
  const stageIndex = STAGES.findIndex((s) => s.key === step)
  const back = () => {
    if (step === 'email') return toLogin()
    if (step === 'code' || step === 'kyc') return setStep('email')
    setStep(STAGES[stageIndex - 1].key)
  }
  const title = clinic ? 'Clinic Sign Up' : 'Consultant Sign Up'

  if (step === 'email' || step === 'code') {
    return (
      <Screen testID={step === 'email' ? 'signup-screen' : 'signup-code'} title={title} back onBack={back}>
        {step === 'email' ? (
          <>
            <Text style={styles.lead}>
              {clinic ? 'Register your clinic on Dentor.' : 'Join Dentor as a visiting consultant.'} Dentor checks every application before the login opens.
            </Text>
            <TextField testID="signup-email" label="Email" required icon="mail" value={email} onChangeText={setEmail} placeholder="example@example.com" keyboardType="email-address" autoCapitalize="none" error={errors.email} onSubmitEditing={sendCode} />
            {problem}
            <Button testID="signup-send" label="Send Code" size="lg" full loading={busy} onPress={sendCode} />
            <Button testID="signup-login" label="Already registered? Log in" variant="ghost" full onPress={toLogin} />
          </>
        ) : (
          <>
            <Text style={styles.lead}>Enter the 4-digit code we sent to {email.trim().toLowerCase()}.</Text>
            <CodeInput value={code} onChange={setCode} error={errors.code} />
            {__DEV__ && !!devCode && <Banner testID="dev-code" tone="brand" icon="info" text={`Development build: the code is ${devCode}`} />}
            {problem}
            <Button testID="signup-verify" label="Verify" size="lg" full loading={busy} onPress={verify} />
            <Button testID="signup-resend" label={wait > 0 ? `Send again in ${wait} s` : 'Send the code again'} variant="ghost" full disabled={wait > 0 || busy} onPress={sendCode} />
          </>
        )}
      </Screen>
    )
  }

  return (
    <Screen testID={`signup-${step}`} title={title} back onBack={back}>
      <View style={styles.stages} accessibilityRole="progressbar" accessibilityLabel={`Step ${stageIndex + 1} of 4: ${STAGES[stageIndex].label}`}>
        {STAGES.map((stage, i) => (
          <View key={stage.key} style={styles.stage}>
            <View style={[styles.dot, i <= stageIndex && { backgroundColor: colors.header, borderColor: colors.header }]}>
              {i < stageIndex ? <Icon name="check" size={13} color="#ffffff" /> : <Text style={[styles.dotText, i <= stageIndex && { color: '#ffffff' }]}>{i + 1}</Text>}
            </View>
            <Text style={[styles.stageText, i === stageIndex && { color: colors.title }]}>{stage.label}</Text>
          </View>
        ))}
      </View>

      {step === 'kyc' && (
        <>
          {field('name', 'Full name', { required: true, autoCapitalize: 'words' })}
          {clinic && field('clinic_name', 'Clinic name', { required: true, autoCapitalize: 'words' })}
          {field('dob', 'Date of birth', { placeholder: 'yyyy-mm-dd', keyboardType: 'numbers-and-punctuation', maxLength: 10 })}
          {field('mobile', 'Mobile number', { required: true, keyboardType: 'phone-pad', maxLength: 14 })}
          {field('alternate_mobile', 'Alternate mobile number', { keyboardType: 'phone-pad', maxLength: 14 })}
          <TextField testID="signup-aadhaar" label="Aadhaar number" value={aadhaar} onChangeText={setAadhaar} keyboardType="number-pad" maxLength={14} error={errors.aadhaar} hint="Only the last four digits are kept." />
          {clinic && field('gst', 'GST number', { autoCapitalize: 'characters', maxLength: 20 })}
          {problem}
          <Button testID="signup-next" label="Next" size="lg" full onPress={kycNext} />
        </>
      )}

      {step === 'academic' && (
        <>
          {field('institution', 'College / institution', { required: true, autoCapitalize: 'words' })}
          {field('graduation_year', 'Year of graduation', { required: true, keyboardType: 'number-pad', maxLength: 4 })}
          {field('dci_number', 'DCI registration number', { required: true, autoCapitalize: 'characters' })}
          {field('specialisation', 'Specialisation', { autoCapitalize: 'words' })}
          <FileField testID="signup-dci-file" label="DCI certificate (photo)" file={files.dci_certificate} onPick={() => attach('dci_certificate')} onClear={() => setFiles((f) => ({ ...f, dci_certificate: undefined }))} />
          {problem}
          <Button testID="signup-next" label="Next" size="lg" full onPress={academicNext} />
        </>
      )}

      {step === 'address' && (
        <>
          {field('door', 'Door / building')}
          {field('street', 'Street')}
          {field('area', 'Area', { required: true })}
          {field('landmark', 'Landmark')}
          {field('pincode', 'PIN code', { required: true, keyboardType: 'number-pad', maxLength: 6 })}
          {field('city', 'City', { required: true, autoCapitalize: 'words' })}
          {field('state', 'State', { required: true, autoCapitalize: 'words' })}
          {field('country', 'Country', { autoCapitalize: 'words' })}
          {clinic && <FileField testID="signup-clinic-file" label="Clinic photo" file={files.clinic_image} onPick={() => attach('clinic_image')} onClear={() => setFiles((f) => ({ ...f, clinic_image: undefined }))} />}
          {problem}
          <Button testID="signup-next" label="Next" size="lg" full onPress={addressNext} />
        </>
      )}

      {step === 'finish' && (
        <>
          {field('experience', 'Experience', { multiline: true, maxLength: 300, placeholder: 'Years of practice, procedures you do most' })}
          {field('facebook', 'Facebook page', { autoCapitalize: 'none' })}
          {field('instagram', 'Instagram', { autoCapitalize: 'none' })}
          <TextField testID="signup-password" label="Password" required secure icon="lock" value={password} onChangeText={setPassword} error={errors.password} hint={STRONG_PASSWORD_RULE} />
          <TextField testID="signup-confirm" label="Confirm password" required secure icon="lock" value={confirm} onChangeText={setConfirm} error={errors.confirm} />
          <Pressable testID="signup-agree" accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => setAgreed((a) => !a)} style={styles.agree}>
            <View style={[styles.tick, agreed && { backgroundColor: colors.header }]}>{agreed && <Icon name="check" size={13} color="#ffffff" />}</View>
            <Text style={styles.agreeText}>I agree to Dentor's terms and conditions and privacy policy.</Text>
          </Pressable>
          {!!errors.agreed && <Text style={styles.error}>{errors.agreed}</Text>}
          {problem}
          <Button testID="signup-submit" label="Register" size="lg" full loading={busy} onPress={submit} />
        </>
      )}

      <MascotDialog
        testID="signup-done"
        visible={done}
        image={mascot}
        title="Successfully Registered"
        message="Dentor will check your application and email you. You can log in once it is approved."
        actions={[{ label: 'OK', testID: 'signup-ok', onPress: () => router.replace('/login') }]}
      />
    </Screen>
  )
}

function FileField({ label, file, onPick, onClear, testID }: { label: string; file?: PickedFile; onPick: () => void; onClear: () => void; testID: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fileLabel}>{label}</Text>
      <View style={styles.file}>
        <Icon name={file ? 'file-text' : 'upload'} size={18} color={colors.header} />
        <Text numberOfLines={1} style={styles.fileName}>{file ? file.name : 'Optional: a photo of up to 2 MB'}</Text>
        {file ? (
          <Pressable testID={`${testID}-clear`} accessibilityRole="button" accessibilityLabel={`Remove ${label}`} hitSlop={8} onPress={onClear}>
            <Icon name="x" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`Attach ${label}`} hitSlop={8} onPress={onPick}>
            <Text style={styles.fileAction}>Attach</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  lead: { ...face('regular'), fontSize: 15, lineHeight: 22, color: colors.text },
  stages: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm },
  stage: { alignItems: 'center', gap: 4, flex: 1 },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  dotText: { ...face('semibold'), fontSize: 13, color: colors.textMuted },
  stageText: { ...face('medium'), fontSize: 12, color: colors.textMuted },
  agree: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tick: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.header, alignItems: 'center', justifyContent: 'center' },
  agreeText: { ...face('regular'), fontSize: 14, lineHeight: 20, color: colors.text, flex: 1 },
  error: { ...face('regular'), fontSize: 13, color: colors.red },
  fileLabel: { ...face('semibold'), fontSize: 13, color: colors.text },
  file: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.fieldBorder, backgroundColor: colors.fieldBg },
  fileName: { ...face('regular'), fontSize: 14, color: colors.text, flex: 1 },
  fileAction: { ...face('semibold'), fontSize: 14, color: colors.header },
})
