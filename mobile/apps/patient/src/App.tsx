import { AppNavigator, AppProviders, Loading, colors, configureApi, useSession, type TabsConfig } from '@dentor/shared'
import { StatusBar, View } from 'react-native'
import { API_URL } from '@/config'
import { routes } from '@/routes.gen'
import { SESSION_KEY, pickSession } from '@/session'
import { TAB_ITEMS } from '@/tabs'
import type { PatientSession } from '@/types'

configureApi({ baseUrl: API_URL })

/** Bottom tabs of the signed-in area: icons only, Home raised in the middle (the design's bar). */
const TABS: Record<string, TabsConfig> = {
  app: { items: TAB_ITEMS, initial: 'index', raised: 'index', labels: false },
}

export default function App() {
  return (
    <AppProviders<PatientSession> storageKey={SESSION_KEY} pick={pickSession}>
      <StatusBar barStyle="light-content" />
      <Gate />
    </AppProviders>
  )
}

/**
 * Three states, each with its own folder of screens under src/app:
 *   (auth)  — signed out: welcome, log in, sign up, forgot password
 *   (setup) — signed in but not yet registered with a clinic
 *   (app)   — signed in with an active clinic profile
 */
function Gate() {
  const { status, data } = useSession<PatientSession>()
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.header }}>
        <Loading />
      </View>
    )
  }
  const group = status !== 'signedIn' ? 'auth' : data?.profile ? 'app' : 'setup'
  return <AppNavigator routes={routes} group={group} tabs={TABS} />
}
