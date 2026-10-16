import { PermissionsPanel } from '@dentor/shared'
import { useEffect, useState } from 'react'
import { Disclaimer } from '@/components/auth/Disclaimer'
import { Onboarding } from '@/components/auth/Onboarding'
import { Splash } from '@/components/auth/Splash'
import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/storage'
import { useRouter } from '@/nav'

/** How long the splash stays up before moving on by itself. */
const SPLASH_MS = 1400

export default function Welcome() {
  const router = useRouter()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let alive = true
    const started = Date.now()
    void hasSeenOnboarding().then((seen) => {
      if (!alive) return
      timer = setTimeout(
        () => (seen ? router.replace('/login') : setShowOnboarding(true)),
        Math.max(0, SPLASH_MS - (Date.now() - started)),
      )
    })
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [router])

  // The design asks a first-time visitor to accept the disclaimer before going on.
  const [next, setNext] = useState<'/signup' | '/login' | null>(null)
  const agree = () => {
    if (!next) return
    void markOnboardingSeen()
    router.replace(next)
  }

  // patient-app.fig "PERMISSIONS" (2:434) comes before the onboarding on the first launch
  const [permissionsSeen, setPermissionsSeen] = useState(false)
  if (!showOnboarding) return <Splash />
  if (!permissionsSeen) return <PermissionsPanel onContinue={() => setPermissionsSeen(true)} />
  return (
    <>
      <Onboarding onSignup={() => setNext('/signup')} onLogin={() => setNext('/login')} />
      <Disclaimer visible={next !== null} onAgree={agree} />
    </>
  )
}
