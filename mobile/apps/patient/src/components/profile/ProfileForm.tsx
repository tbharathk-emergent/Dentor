import { Button, Screen, Section, TextField, space, useToast } from '@dentor/shared'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { ChoiceChips } from '@/components/ChoiceChips'
import { MobileField } from '@/components/auth/MobileField'
import { PhotoField } from '@/components/profile/PhotoField'
import { useUpdateProfile } from '@/hooks/useMe'
import { BLOOD_GROUPS, GENDERS } from '@/lib/options'
import { ageProblem, birthDateProblem, emailProblem, isClean, mobileProblem, nameProblem, normalizeMobile, onlyDigits } from '@/lib/validate'
import { useRouter } from '@/nav'
import type { MeData, ProfileChanges } from '@/types'

type TextKey = 'name' | 'email' | 'gender' | 'blood' | 'dob' | 'address' | 'city' | 'allergy' | 'history' | 'emergencyName' | 'emergencyMobile' | 'photo'
type Draft = Record<TextKey, string> & { age: string }
type Errors = Partial<Record<'name' | 'email' | 'age' | 'dob' | 'emergencyMobile', string>>

const TEXT_KEYS: TextKey[] = ['name', 'email', 'gender', 'blood', 'dob', 'address', 'city', 'allergy', 'history', 'emergencyName', 'emergencyMobile', 'photo']

function toDraft(profile: MeData['profile']): Draft {
  const draft = { age: profile.age === '' || profile.age == null ? '' : String(profile.age) } as Draft
  for (const key of TEXT_KEYS) draft[key] = String(profile[key] ?? '')
  // The front desk may have typed it with a prefix or spaces; the field holds the ten digits.
  draft.emergencyMobile = normalizeMobile(draft.emergencyMobile)
  return draft
}

/** Only what the patient actually changed is sent to the API. */
function changedFields(draft: Draft, saved: Draft): ProfileChanges {
  const changes: ProfileChanges = {}
  for (const key of TEXT_KEYS) {
    const value = key === 'photo' ? draft[key] : key === 'emergencyMobile' ? normalizeMobile(draft[key]) : draft[key].trim()
    if (value !== saved[key]) changes[key] = value
  }
  if (draft.age !== saved.age && draft.age !== '') changes.age = Number(draft.age)
  return changes
}

/** The edit-profile screen once the profile has loaded. */
export function ProfileForm({ me }: { me: MeData }) {
  const router = useRouter()
  const toast = useToast()
  const save = useUpdateProfile()
  const [saved] = useState(() => toDraft(me.profile))
  const [draft, setDraft] = useState(saved)
  const [errors, setErrors] = useState<Errors>({})

  const set = (key: keyof Draft) => (value: string) => setDraft((current) => ({ ...current, [key]: value }))
  const changes = changedFields(draft, saved)
  const dirty = Object.keys(changes).length > 0 || draft.age !== saved.age

  const submit = () => {
    const found: Errors = {
      name: nameProblem(draft.name),
      email: emailProblem(draft.email),
      // The API cannot clear an age once it is on the record.
      age: ageProblem(draft.age, { required: saved.age !== '' }),
      dob: birthDateProblem(draft.dob.trim()),
      emergencyMobile: mobileProblem(draft.emergencyMobile, { required: false }),
    }
    setErrors(found)
    if (!isClean(found)) {
      toast.error('Please fix the highlighted fields.')
      return
    }
    save.mutate(changes, {
      onSuccess: () => {
        toast.success('Profile updated')
        if (router.canGoBack()) router.back()
        else router.replace('/profile')
      },
      onError: (error) => toast.error(error),
    })
  }

  return (
    <Screen
      testID="edit-profile-screen"
      title="Edit profile"
      back
      footer={<Button testID="profile-save" label="Save changes" size="lg" full disabled={!dirty} loading={save.isPending} onPress={submit} />}
    >
      <PhotoField name={draft.name} value={draft.photo} onChange={set('photo')} />

      <Section title="About you" style={styles.section}>
        <TextField testID="profile-name-input" label="Full name" required value={draft.name} onChangeText={set('name')} autoCapitalize="words" error={errors.name} />
        <TextField
          testID="profile-mobile"
          label="Mobile number"
          value={`+91 ${me.account.mobile}`}
          onChangeText={() => {}}
          editable={false}
          icon="phone"
          hint="Your login number. Ask the clinic if it needs to change."
        />
        <TextField
          testID="profile-email"
          label="Email"
          value={draft.email}
          onChangeText={set('email')}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          icon="mail"
          error={errors.email}
        />
        <TextField
          testID="profile-age"
          label="Age"
          value={draft.age}
          onChangeText={(text) => set('age')(onlyDigits(text, 3))}
          keyboardType="number-pad"
          placeholder="Years"
          error={errors.age}
        />
        <ChoiceChips testID="profile-gender" label="Gender" options={GENDERS} value={draft.gender} onChange={set('gender')} />
        <TextField
          testID="profile-dob"
          label="Date of birth"
          value={draft.dob}
          onChangeText={set('dob')}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          error={errors.dob}
        />
      </Section>

      <Section title="Address" style={styles.section}>
        <TextField testID="profile-address" label="Address" value={draft.address} onChangeText={set('address')} multiline maxLength={300} />
        <TextField testID="profile-city" label="City" value={draft.city} onChangeText={set('city')} autoCapitalize="words" maxLength={80} />
      </Section>

      <Section title="Medical notes" style={styles.section}>
        <ChoiceChips testID="profile-blood" label="Blood group" options={BLOOD_GROUPS} value={draft.blood} onChange={set('blood')} clearable />
        <TextField testID="profile-allergy" label="Allergies" value={draft.allergy} onChangeText={set('allergy')} placeholder="e.g. Penicillin" maxLength={200} />
        <TextField
          testID="profile-history"
          label="Medical history"
          value={draft.history}
          onChangeText={set('history')}
          placeholder="Conditions and regular medicines your dentist should know about"
          multiline
          maxLength={500}
        />
      </Section>

      <Section title="Emergency contact" style={styles.section}>
        <TextField testID="profile-emergency-name" label="Name" value={draft.emergencyName} onChangeText={set('emergencyName')} autoCapitalize="words" maxLength={80} />
        <MobileField testID="profile-emergency-mobile" label="Mobile number" required={false} value={draft.emergencyMobile} onChange={set('emergencyMobile')} error={errors.emergencyMobile} />
      </Section>
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: { gap: space.md },
})
