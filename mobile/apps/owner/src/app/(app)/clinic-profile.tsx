import { Banner, Button, Card, KeyValue, QueryState, Screen, Section, TextField, space, useToast } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { useClinicProfile, useUpdateClinic } from '@/hooks/useClinicProfile'
import { useRefresh } from '@/hooks/useRefresh'
import { EMAIL_PATTERN, phoneProblem } from '@/lib/validation'
import type { Clinic, ClinicContact } from '@/types'

type ContactErrors = Partial<Record<keyof ClinicContact, string>>

const contactOf = (clinic: Clinic): ClinicContact => ({
  phone: clinic.phone ?? '',
  email: clinic.email ?? '',
  address: clinic.address ?? '',
  city: clinic.city ?? '',
})

const tidy = (values: ClinicContact): ClinicContact => ({
  phone: values.phone.trim(),
  email: values.email.trim().toLowerCase(),
  address: values.address.trim(),
  city: values.city.trim(),
})

export default function ClinicProfileScreen() {
  const toast = useToast()
  const profile = useClinicProfile()
  const save = useUpdateClinic()
  const { refreshing, refresh } = useRefresh(profile)
  // Null until the owner types: the form then shows what the server has, including after a save.
  const [draft, setDraft] = useState<ClinicContact | null>(null)
  const [errors, setErrors] = useState<ContactErrors>({})

  const clinic = profile.data?.clinic
  const saved = clinic ? contactOf(clinic) : null
  const values = draft ?? saved
  const changes: Partial<ClinicContact> = {}
  if (values && saved) {
    const next = tidy(values)
    for (const field of Object.keys(next) as (keyof ClinicContact)[]) {
      if (next[field] !== saved[field]) changes[field] = next[field]
    }
  }
  const dirty = Object.keys(changes).length > 0
  const edit = (field: keyof ClinicContact) => (text: string) => values && setDraft({ ...values, [field]: text })

  const submit = () => {
    if (!values) return
    const next = tidy(values)
    const problems: ContactErrors = {}
    const phone = phoneProblem(next.phone)
    if (phone) problems.phone = phone
    if (next.email && !EMAIL_PATTERN.test(next.email)) problems.email = 'Enter a valid email address, for example hello@clinic.in.'
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    const submitted = draft
    save.mutate(changes, {
      onSuccess: () => {
        // Back to showing what the server has, unless the owner has typed again since saving.
        setDraft((current) => (current === submitted ? null : current))
        toast.success('Clinic profile saved')
      },
      onError: (error) => toast.error(error),
    })
  }

  return (
    <Screen
      testID="clinic-profile-screen"
      title="Clinic profile"
      back
      refreshing={refreshing}
      onRefresh={refresh}
      footer={values ? <Button testID="clinic-save" label="Save changes" size="lg" full disabled={!dirty} loading={save.isPending} onPress={submit} /> : undefined}
    >
      <QueryState query={profile}>
        {({ clinic: record }) => (
          <>
            <Section title="Clinic">
              <Card testID="clinic-identity">
                <KeyValue label="Name" value={record.name} strong />
                <KeyValue label="Clinic code" value={record.code} />
                <KeyValue label="Plan" value={record.plan} />
                <KeyValue label="Status" value={record.status} />
              </Card>
              <Banner tone="slate" icon="lock" text="The name, code, plan and status are managed by Dentor. Contact Dentor support to change them." />
            </Section>
            {values && (
              <Section title="Contact details">
                <View style={{ gap: space.lg }}>
                  <TextField testID="clinic-phone" label="Phone" value={values.phone} onChangeText={edit('phone')} keyboardType="phone-pad" maxLength={30} placeholder="+91 98765 43210" error={errors.phone} />
                  <TextField testID="clinic-email" label="Email" value={values.email} onChangeText={edit('email')} keyboardType="email-address" autoCapitalize="none" maxLength={120} placeholder="hello@clinic.in" error={errors.email} />
                  <TextField testID="clinic-address" label="Address" value={values.address} onChangeText={edit('address')} multiline maxLength={300} placeholder="Street, area and PIN code" />
                  <TextField testID="clinic-city" label="City" value={values.city} onChangeText={edit('city')} autoCapitalize="words" maxLength={80} />
                </View>
              </Section>
            )}
          </>
        )}
      </QueryState>
    </Screen>
  )
}
