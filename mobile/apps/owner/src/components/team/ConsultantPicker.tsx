import { Banner, Button, Icon, Skeleton, T, colors, errorMessage, radius, space, TOUCH } from '@dentor/shared'
import { Pressable, StyleSheet, View } from 'react-native'
import type { ConsultantProfile } from '@/types'

interface ProfilesQuery {
  data: ConsultantProfile[] | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
}

/**
 * Chooses the consultant profile a Consultant login belongs to. Profiles that already have a
 * login (`takenIds`) are left out, because the API allows one login per profile.
 */
export function ConsultantPicker({
  profiles,
  takenIds,
  value,
  onChange,
  error,
  scope,
}: {
  profiles: ProfilesQuery
  takenIds: string[]
  value: string
  onChange: (id: string) => void
  error?: string
  scope: string
}) {
  const available = (profiles.data ?? []).filter((profile) => !takenIds.includes(profile.id))
  return (
    <View testID={`${scope}-consultants`} style={{ gap: 6 }}>
      <T variant="smallStrong">
        Consultant profile<T variant="smallStrong" color={colors.red}>{' *'}</T>
      </T>
      {profiles.isLoading ? (
        <View style={{ gap: space.sm }}>
          <Skeleton height={TOUCH + 8} />
          <Skeleton height={TOUCH + 8} />
        </View>
      ) : profiles.isError || !profiles.data ? (
        <View style={{ gap: space.sm }}>
          <Banner tone="red" icon="alert-circle" text={errorMessage(profiles.error, 'Could not load the consultant profiles.')} />
          <Button testID={`${scope}-consultants-retry`} label="Try again" icon="refresh-cw" variant="outline" onPress={() => profiles.refetch()} />
        </View>
      ) : available.length === 0 ? (
        <View testID={`${scope}-consultants-empty`}>
          <Banner tone="amber" icon="info" text="Every consultant profile already has a login. Add the consultant in the reception app first." />
        </View>
      ) : (
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          {available.map((profile) => {
            const selected = profile.id === value
            return (
              <Pressable
                key={profile.id}
                testID={`${scope}-consultant-${profile.id}`}
                accessibilityRole="radio"
                accessibilityLabel={profile.name}
                accessibilityState={{ selected }}
                onPress={() => onChange(profile.id)}
                style={[styles.option, selected && styles.selected]}
              >
                <Icon name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? colors.brand700 : colors.textFaint} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T variant="bodyStrong" numberOfLines={1}>
                    {profile.name}
                  </T>
                  <T variant="small" color={colors.textMuted} numberOfLines={1}>
                    {[profile.specialty, profile.type].filter(Boolean).join(' · ') || profile.code}
                  </T>
                </View>
              </Pressable>
            )
          })}
        </View>
      )}
      {!!error && (
        <T variant="small" color={colors.red}>
          {error}
        </T>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 8, paddingHorizontal: space.md, paddingVertical: space.sm,
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
})
