import { QueryState, Screen, Segmented } from '@dentor/shared'
import { useState } from 'react'
import { PeriodControl } from '@/components/PeriodControl'
import { DoctorList } from '@/components/team/DoctorList'
import { LoginsPanel } from '@/components/team/LoginsPanel'
import { StaffDirectory } from '@/components/team/StaffDirectory'
import { useLogins } from '@/hooks/useLogins'
import { usePeriod } from '@/hooks/usePeriod'
import { useRefresh } from '@/hooks/useRefresh'
import { useTeam } from '@/hooks/useTeam'

type Segment = 'doctors' | 'staff' | 'logins'

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'doctors', label: 'Doctors' },
  { key: 'staff', label: 'Staff' },
  { key: 'logins', label: 'Logins' },
]

export default function TeamScreen() {
  const [segment, setSegment] = useState<Segment>('doctors')
  const period = usePeriod()
  const team = useTeam(period.range)
  const logins = useLogins()
  const { refreshing, refresh } = useRefresh(team, logins)

  return (
    <Screen testID="team-screen" title="Team" subtitle="Doctors, staff and who can sign in" refreshing={refreshing} onRefresh={refresh}>
      <Segmented options={SEGMENTS} value={segment} onChange={setSegment} />
      {segment === 'doctors' && (
        <>
          <PeriodControl scope="team" updating={team.isPlaceholderData} />
          <QueryState query={team}>{(data) => <DoctorList doctors={data.doctors} />}</QueryState>
        </>
      )}
      {segment === 'staff' && <QueryState query={team}>{(data) => <StaffDirectory staff={data.staff} />}</QueryState>}
      {segment === 'logins' && <LoginsPanel logins={logins} />}
    </Screen>
  )
}
