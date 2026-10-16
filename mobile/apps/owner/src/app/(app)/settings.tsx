import { SettingsScreen, useSession } from '@dentor/shared'

export default function Settings() {
  const { data } = useSession<{ user?: { email?: string } | null }>()
  return <SettingsScreen scope="owner" email={data?.user?.email ?? undefined} />
}
