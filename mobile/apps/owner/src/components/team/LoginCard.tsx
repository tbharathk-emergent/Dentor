import { Avatar, Badge, Button, Card, T, colors, roleTone, space, statusTone } from '@dentor/shared'
import { View } from 'react-native'
import type { ClinicLogin } from '@/types'

/**
 * One login with its role and status. On the signed-in owner's own login the second action is
 * "Change password" (a reset would sign them out), and Edit offers the name only.
 */
export function LoginCard({ login, isSelf, onEdit, onPassword }: { login: ClinicLogin; isSelf: boolean; onEdit: () => void; onPassword: () => void }) {
  return (
    <Card testID={`login-${login.email}`} style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar name={login.name} size={40} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T variant="bodyStrong" numberOfLines={1} testID={`login-name-${login.email}`}>
            {login.name}
          </T>
          <T variant="small" color={colors.textMuted} numberOfLines={1}>
            {login.email}
          </T>
        </View>
        {isSelf && <Badge testID="login-you" label="You" tone="brand" />}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Badge testID={`login-role-${login.email}`} label={login.role} tone={roleTone(login.role)} />
        <Badge testID={`login-status-${login.email}`} label={login.status} tone={statusTone(login.status)} />
        {!!login.consultant_name && <Badge label={`Profile: ${login.consultant_name}`} tone="slate" />}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Button testID={`login-edit-${login.email}`} label="Edit" icon="edit-2" variant="outline" onPress={onEdit} />
        <Button testID={`login-password-${login.email}`} label={isSelf ? 'Change password' : 'Reset password'} icon="key" variant="outline" onPress={onPassword} />
      </View>
    </Card>
  )
}
