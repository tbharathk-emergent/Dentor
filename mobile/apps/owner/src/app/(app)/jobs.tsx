import { JobsScreen, useSession } from '@dentor/shared'
import { can } from '@/lib/access'
import type { StaffSession } from '@/types'

export default function Jobs() {
  const role = useSession<StaffSession>().data?.user?.role
  return <JobsScreen canHire={can(role, 'admin')} defaultKind="seeking" />
}
