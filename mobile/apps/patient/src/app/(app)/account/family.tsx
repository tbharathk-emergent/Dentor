import { Banner, Button, QueryState, Screen, useSession, useToast } from '@dentor/shared'
import { useState } from 'react'
import { Rows } from '@/components/Rows'
import { AddFamilySheet } from '@/components/profile/AddFamilySheet'
import { ProfileRow } from '@/components/profile/ProfileRow'
import { useProfiles, useSelectProfile } from '@/hooks/useProfiles'
import { useRefresh } from '@/hooks/useRefresh'
import { useRouter } from '@/nav'
import type { PatientSession, Profile } from '@/types'

const sameProfile = (a: Profile, b: Profile | null | undefined) => !!b && a.patient_id === b.patient_id && a.clinic_id === b.clinic_id

export default function Family() {
  const router = useRouter()
  const toast = useToast()
  const { data: session, signIn } = useSession<PatientSession>()
  const profiles = useProfiles()
  const select = useSelectProfile()
  const { refreshing, onRefresh } = useRefresh(profiles.refetch)
  const [adding, setAdding] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<Profile | null>(null)

  const switchTo = (profile: Profile) => {
    setSwitchingTo(profile)
    select.mutate(profile, {
      onSuccess: async (payload) => {
        // The new session makes every screen load this person's data.
        await signIn(payload)
        toast.success(`Now using ${profile.name}'s profile`)
        if (router.canGoBack()) router.back()
        else router.replace('/')
      },
      onError: (error) => {
        toast.error(error)
        setSwitchingTo(null)
      },
    })
  }

  return (
    <Screen
      testID="family-screen"
      title="Family members"
      back
      refreshing={refreshing}
      onRefresh={onRefresh}
      footer={<Button testID="family-add" label="Add a family member" icon="user-plus" full onPress={() => setAdding(true)} />}
    >
      <Banner tone="blue" icon="users" text="Everyone registered with your mobile number appears here. Switch profile to book visits and see records for that person." />
      <QueryState query={profiles}>
        {(data) => (
          <Rows testID="profile-list">
            {data.items.map((profile) => (
              <ProfileRow
                key={`${profile.clinic_id}-${profile.patient_id}`}
                profile={profile}
                active={sameProfile(profile, session?.profile)}
                switching={sameProfile(profile, switchingTo)}
                disabled={!!switchingTo}
                onSwitch={() => switchTo(profile)}
              />
            ))}
          </Rows>
        )}
      </QueryState>
      <AddFamilySheet visible={adding} onClose={() => setAdding(false)} clinicName={session?.profile?.clinic_name ?? 'your clinic'} />
    </Screen>
  )
}
