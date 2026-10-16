import { Chip, T, colors, space } from '@dentor/shared'
import { View } from 'react-native'
import { slug } from '@/lib/format'
import { roleAccess } from '@/lib/roles'

/** Role chips (the roles come from the API) with a line saying what the chosen role can reach. */
export function RolePicker({ roles, value, onChange, error, scope }: { roles: string[]; value: string; onChange: (role: string) => void; error?: string; scope: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T variant="smallStrong">
        Role<T variant="smallStrong" color={colors.red}>{' *'}</T>
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {roles.map((role) => (
          <Chip key={role} testID={`${scope}-role-${slug(role)}`} label={role} selected={role === value} onPress={() => onChange(role)} />
        ))}
      </View>
      {error ? (
        <T variant="small" color={colors.red}>
          {error}
        </T>
      ) : value ? (
        <T variant="small" color={colors.textMuted} testID={`${scope}-role-access`}>
          {roleAccess(value)}
        </T>
      ) : null}
    </View>
  )
}
