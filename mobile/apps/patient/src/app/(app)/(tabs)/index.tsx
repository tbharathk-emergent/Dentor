import { QueryState, Screen, Skeleton, SkeletonList, fmtINR, useNotifications, useSession } from '@dentor/shared'
import { Rows } from '@/components/Rows'
import { Announcement } from '@/components/home/Announcement'
import { PatientHeader } from '@/components/PatientHeader'
import { TipBanner } from '@/components/home/TipBanner'
import { HomeNotice } from '@/components/home/HomeNotice'
import { ModuleGrid } from '@/components/home/ModuleGrid'
import { NextAppointment } from '@/components/home/NextAppointment'
import { PATIENT_API } from '@/endpoints'
import { useHome } from '@/hooks/useHome'
import { usePushRegistration } from '@/hooks/usePushRegistration'
import { useRefresh } from '@/hooks/useRefresh'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'
import { useRouter } from '@/nav'
import type { PatientSession } from '@/types'

export default function Home() {
  const router = useRouter()
  const { data: session } = useSession<PatientSession>()
  const home = useHome()
  const notifications = useNotifications(PATIENT_API)
  const { refreshing, onRefresh } = useRefresh(home.refetch, notifications.refetch)
  usePushRegistration()

  // Coming back from any screen (a booking, the chat, a signed consent) shows fresh numbers.
  useRefreshOnFocus(home.refetch, notifications.refetch)

  return (
    <Screen
      testID="home-screen"
      header={<PatientHeader clinicName={home.data?.clinic.name ?? session?.profile?.clinic_name} clinicPhone={home.data?.clinic.phone} showCall />}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <QueryState query={home} skeleton={<HomeSkeleton />}>
        {(data) => (
          <>
            <TipBanner />
            <ModuleGrid home={data} />
            <NextAppointment appointment={data.next_appointment} upcomingCount={data.upcoming_count} />
            {data.outstanding > 0 && (
              <HomeNotice
                testID="home-outstanding"
                icon="credit-card"
                tone="amber"
                title={`${fmtINR(data.outstanding)} to pay`}
                detail="See your bills. Payment is made at the clinic."
                onPress={() => router.push('/payments')}
              />
            )}
            {data.pending_consents > 0 && (
              <HomeNotice
                testID="home-consents"
                icon="edit-3"
                tone="blue"
                title={data.pending_consents === 1 ? 'A consent form is waiting' : `${data.pending_consents} consent forms are waiting`}
                detail="Review and sign before your visit."
                onPress={() => router.push('/consents')}
              />
            )}
            {data.banner && <Announcement banner={data.banner} />}
          </>
        )}
      </QueryState>
    </Screen>
  )
}

function HomeSkeleton() {
  return (
    <Rows>
      <Skeleton height={132} />
      <SkeletonList rows={3} />
    </Rows>
  )
}
