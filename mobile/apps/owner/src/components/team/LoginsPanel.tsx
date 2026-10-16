import { Button, EmptyState, QueryState, T, colors, space, useSession } from '@dentor/shared'
import type { UseQueryResult } from '@tanstack/react-query'
import { useState } from 'react'
import { View } from 'react-native'
import { AddLoginSheet } from '@/components/team/AddLoginSheet'
import { EditLoginSheet } from '@/components/team/EditLoginSheet'
import { LoginCard } from '@/components/team/LoginCard'
import { ResetPasswordSheet } from '@/components/team/ResetPasswordSheet'
import { plural } from '@/lib/format'
import { useRouter } from '@/nav'
import type { ClinicLogin, ClinicLogins, StaffSession } from '@/types'

/** Who can sign in to this clinic: add a login, edit one, or reset its password. */
export function LoginsPanel({ logins }: { logins: UseQueryResult<ClinicLogins> }) {
  const router = useRouter()
  const { data: session, update } = useSession<StaffSession>()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<ClinicLogin | null>(null)
  const [resetting, setResetting] = useState<ClinicLogin | null>(null)
  const me = session?.user
  const isSelf = (login: ClinicLogin | null) => !!login && !!me && (login.id === me.id || login.email === me.email)

  return (
    <QueryState query={logins}>
      {(data) => {
        const takenConsultantIds = data.items.map((login) => login.consultant_id).filter(Boolean)
        return (
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
              <T variant="small" color={colors.textMuted} testID="logins-count" style={{ flexShrink: 1 }}>
                {`${plural(data.items.length, 'login')} for this clinic`}
              </T>
              <Button testID="add-login" label="Add login" icon="user-plus" onPress={() => setAdding(true)} />
            </View>

            {data.items.length === 0 ? (
              <EmptyState testID="logins-empty" icon="key" title="No logins yet" message="Add a login for each person who should sign in to Dentor." />
            ) : (
              data.items.map((login) => (
                <LoginCard
                  key={login.id}
                  login={login}
                  isSelf={isSelf(login)}
                  onEdit={() => setEditing(login)}
                  onPassword={() => (isSelf(login) ? router.push('/change-password') : setResetting(login))}
                />
              ))
            )}

            <AddLoginSheet visible={adding} onClose={() => setAdding(false)} roles={data.roles} takenConsultantIds={takenConsultantIds} />
            <EditLoginSheet
              login={editing}
              isSelf={isSelf(editing)}
              roles={data.roles}
              takenConsultantIds={takenConsultantIds}
              onClose={() => setEditing(null)}
              onSaved={(saved) => {
                // Keep the name shown around the app in step when the owner renames their own login.
                if (me && isSelf(saved)) void update({ user: { ...me, name: saved.name } })
              }}
            />
            <ResetPasswordSheet login={resetting} onClose={() => setResetting(null)} />
          </View>
        )
      }}
    </QueryState>
  )
}
