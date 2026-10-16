import { Button, Card, Screen, space, TextField, useToast } from '@dentor/shared'
import { useState } from 'react'
import { useLeave } from '@/hooks/useLeave'
import { useUpdateProfile } from '@/hooks/useProfile'
import { changesOf, draftOf, PROFILE_LIMITS, validateProfile, type ProfileDraft } from '@/lib/profileForm'
import type { ConsultantProfile } from '@/types'

/** Edit screen body, mounted once the saved profile is known (it seeds the fields). */
export function ProfileForm({ profile }: { profile: ConsultantProfile }) {
  const leave = useLeave()
  const toast = useToast()
  const update = useUpdateProfile()
  const [draft, setDraft] = useState<ProfileDraft>(() => draftOf(profile))
  const [checked, setChecked] = useState(false)
  const errors = validateProfile(draft)
  const changes = changesOf(draft, profile)
  const set = (patch: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...patch }))

  const save = () => {
    setChecked(true)
    if (Object.keys(errors).length > 0) return
    update.mutate(changes, {
      onSuccess: () => {
        toast.success('Details saved')
        leave()
      },
      onError: (err) => toast.error(err),
    })
  }

  return (
    <Screen
      testID="screen-edit-profile"
      title="Edit details"
      subtitle={profile.name}
      back
      footer={<Button testID="profile-save" label="Save changes" size="lg" full disabled={Object.keys(changes).length === 0} loading={update.isPending} onPress={save} />}
    >
      <Card style={{ gap: space.lg }}>
        <TextField
          testID="profile-availability-input"
          label="Availability"
          value={draft.availability}
          onChangeText={(availability) => set({ availability })}
          placeholder="Mon–Sat · 9 AM–5 PM"
          hint="Shown to patients when they book with you."
          maxLength={PROFILE_LIMITS.availability}
        />
        <TextField
          testID="profile-location-input"
          label="Location"
          value={draft.location}
          onChangeText={(location) => set({ location })}
          placeholder="Town or branch"
          autoCapitalize="words"
          maxLength={PROFILE_LIMITS.location}
        />
        <TextField
          testID="profile-phone-input"
          label="Phone"
          value={draft.phone}
          onChangeText={(phone) => set({ phone })}
          placeholder="+91 98765 43210"
          keyboardType="phone-pad"
          error={checked ? errors.phone : undefined}
          maxLength={PROFILE_LIMITS.phone}
        />
        <TextField
          testID="profile-about-input"
          label="About"
          value={draft.about}
          onChangeText={(about) => set({ about })}
          placeholder="Your training, interests and the care you offer"
          multiline
          hint={`${draft.about.length}/${PROFILE_LIMITS.about}`}
          maxLength={PROFILE_LIMITS.about}
        />
      </Card>
    </Screen>
  )
}
