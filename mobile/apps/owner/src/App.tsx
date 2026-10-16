import { AppNavigator, AppProviders, Loading, colors, configureApi, useSession, welcomeSeen } from '@dentor/shared'
import { useEffect, useState } from 'react'
import { StatusBar, View } from 'react-native'
import { API_URL } from '@/config'
import { routes } from '@/routes.gen'
import { TABS } from '@/tabs'
import type { StaffSession } from '@/types'

configureApi({ baseUrl: API_URL })

// Module-level so its identity is stable across renders.
const pick = (payload: Record<string, any>, previous: StaffSession | null): StaffSession => ({
  user: payload.user ?? previous?.user ?? null,
})

export default function App() {
  return (
    <AppProviders<StaffSession> storageKey="dentor.owner.session" pick={pick}>
      <StatusBar barStyle="light-content" />
      <Gate />
    </AppProviders>
  )
}

// Signed out, the app opens on the login screen (forgot password and sign-up open from it); on the
// very first launch it opens on the permissions, onboarding and disclaimer screens instead.
const START_LOGIN = { root: 'login' }
const START_WELCOME = { root: 'welcome' }

/** Signed-out users reach the login, forgot-password and sign-up screens; signed-in users only reach the app. */
function Gate() {
  const { status } = useSession<StaffSession>()
  const [welcomed, setWelcomed] = useState<boolean | null>(null)
  useEffect(() => {
    welcomeSeen('owner').then(setWelcomed)
  }, [])
  // Anyone who has been signed in has seen them (signing out then opens on the login screen).
  useEffect(() => {
    if (status === 'signedIn') setWelcomed(true)
  }, [status])
  if (status === 'loading' || welcomed === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <Loading />
      </View>
    )
  }
  return <AppNavigator routes={routes} group={status === 'signedIn' ? 'app' : 'root'} tabs={TABS} start={welcomed ? START_LOGIN : START_WELCOME} />
}
