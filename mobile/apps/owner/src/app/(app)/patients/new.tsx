import { Banner, Button, Chip, ConfirmSheet, Row, Screen, Section, T, TextField, errorMessage, mobileProblem, normalizeMobile, space, useToast, EMAIL_PATTERN } from '@dentor/shared'
import { useState } from 'react'
import { useAddPatient } from '@/clinic/hooks'
import type { NewPatient } from '@/clinic/types'
import { useRouter } from '@/nav'

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
const GENDERS = ['Male', 'Female', 'Other']

/** "Add patient" (dentor.fig 7977:4638): personal, contact, medical and additional information, then "sucessfully added" (7977:4759). */
export default function AddPatient() {
  const router = useRouter()
  const toast = useToast()
  const add = useAddPatient()
  const [form, setForm] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<string | null>(null)
  const v = (k: string) => form[k] ?? ''
  const set = (k: string) => (text: string) => setForm((f) => ({ ...f, [k]: text }))
  const field = (k: string, label: string, extra: Partial<Parameters<typeof TextField>[0]> = {}) => (
    <TextField testID={`patient-${k}`} label={label} value={v(k)} onChangeText={set(k)} error={errors[k]} {...extra} />
  )

  const save = (allowDuplicate = false) => {
    const found = {
      name: v('name').trim().length < 2 ? "Enter the patient's full name." : undefined,
      mobile: mobileProblem(v('mobile')),
      dob: v('dob') && !/^\d{4}-\d{2}-\d{2}$/.test(v('dob')) ? 'Use the form yyyy-mm-dd, like 1990-02-01.' : undefined,
      email: v('email') && !EMAIL_PATTERN.test(v('email').trim()) ? 'Enter a valid email address.' : undefined,
      bp: v('bp') && !/^\d{2,3}\/\d{2,3}$/.test(v('bp').trim()) ? 'Write it like 120/80.' : undefined,
      glucose: v('glucose') && !/^\d{2,3}(\.\d)?$/.test(v('glucose').trim()) ? 'Write it in mg/dL, like 110.' : undefined,
      emergencyMobile: mobileProblem(v('emergencyMobile'), { required: false }),
    }
    setErrors(found)
    setFailure(null)
    if (Object.values(found).some(Boolean)) return
    const body: NewPatient = {
      name: v('name').trim(), mobile: normalizeMobile(v('mobile')), dob: v('dob') || undefined, gender: v('gender') || undefined, blood: v('blood') || undefined,
      email: v('email').trim() || undefined, address: v('address').trim() || undefined, city: v('city').trim() || undefined,
      allergy: v('allergy').trim() || undefined, history: v('history').trim() || undefined, visit_reason: v('visit_reason').trim() || undefined,
      bp: v('bp').trim() || undefined, glucose: v('glucose').trim() || undefined, insurance_company: v('insurance_company').trim() || undefined,
      insurance_policy: v('insurance_policy').trim() || undefined, emergencyName: v('emergencyName').trim() || undefined,
      emergencyMobile: v('emergencyMobile') ? normalizeMobile(v('emergencyMobile')) : undefined, allow_duplicate: allowDuplicate,
    }
    add.mutate(body, {
      onSuccess: (p) => {
        setDuplicate(null)
        toast.success(`${p.name} added as ${p.code}.`)
        router.replace({ pathname: '/patients/[id]', params: { id: p.id } })
      },
      onError: (e) => {
        if ((e as { status?: number }).status === 409) setDuplicate(errorMessage(e))
        else setFailure(errorMessage(e))
      },
    })
  }

  return (
    <Screen testID="add-patient-screen" title="Add Patient" back footer={<Button testID="patient-save" label="Save Patient Profile" size="lg" full loading={add.isPending} onPress={() => save(false)} />}>
      <Section title="Personal Information">
        {field('name', 'Full name', { required: true, autoCapitalize: 'words', placeholder: 'e.g. Johnathan Doe', maxLength: 80 })}
        {field('dob', 'Date of birth', { placeholder: 'yyyy-mm-dd', keyboardType: 'numbers-and-punctuation', maxLength: 10 })}
        <T variant="smallStrong">Gender</T>
        <Row wrap gap={space.sm}>{GENDERS.map((g) => <Chip key={g} testID={`gender-${g}`} label={g} selected={v('gender') === g} onPress={() => set('gender')(v('gender') === g ? '' : g)} />)}</Row>
        <T variant="smallStrong">Blood group</T>
        <Row wrap gap={space.sm}>{BLOOD.map((b) => <Chip key={b} label={b} selected={v('blood') === b} onPress={() => set('blood')(v('blood') === b ? '' : b)} />)}</Row>
      </Section>
      <Section title="Contact Details">
        {field('mobile', 'Phone number', { required: true, keyboardType: 'phone-pad', maxLength: 14 })}
        {field('email', 'Email address', { keyboardType: 'email-address', autoCapitalize: 'none', placeholder: 'patient@example.com' })}
        {field('address', 'Address', { placeholder: 'Street, area' })}
        {field('city', 'City', { autoCapitalize: 'words' })}
      </Section>
      <Section title="Medical Information">
        {field('visit_reason', 'Reason for visit', { placeholder: 'Primary concern' })}
        {field('bp', 'Blood pressure (mmHg)', { placeholder: '120/80', keyboardType: 'numbers-and-punctuation', maxLength: 7 })}
        {field('glucose', 'Blood glucose (mg/dL)', { placeholder: '110', keyboardType: 'decimal-pad', maxLength: 5 })}
        {field('allergy', 'Allergies', { placeholder: 'e.g. Penicillin' })}
        {field('history', 'Medical history', { placeholder: 'e.g. Diabetes', multiline: true, maxLength: 300 })}
      </Section>
      <Section title="Additional Information">
        {field('insurance_company', 'Insurance company')}
        {field('insurance_policy', 'Policy number', { autoCapitalize: 'characters' })}
        {field('emergencyName', 'Emergency contact name', { autoCapitalize: 'words' })}
        {field('emergencyMobile', 'Emergency contact number', { keyboardType: 'phone-pad', maxLength: 14 })}
      </Section>
      {!!failure && <Banner testID="patient-error" tone="red" icon="alert-circle" text={failure} />}
      <ConfirmSheet
        visible={!!duplicate}
        onClose={() => setDuplicate(null)}
        onConfirm={() => save(true)}
        loading={add.isPending}
        title="This patient may already exist"
        message={duplicate ?? ''}
        confirmLabel="Add anyway"
      />
    </Screen>
  )
}
