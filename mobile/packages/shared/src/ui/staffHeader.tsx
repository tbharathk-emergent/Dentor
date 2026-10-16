import { colors, space } from '../theme'
import { Avatar, IconButton } from './primitives'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * The staff designs' greeting header on white (dentor.fig: Consultant "Home" 6933:11981, Clinic
 * "Home" 37:626): the photo, "Hi, WelcomeBack" in the brand's link colour, the name and the code
 * in black, and the bell and the settings gear on the right. The Consultant design sets the
 * text in League Spartan Bold, the Clinic design in League Spartan Light and Regular (`light`).
 */
export function StaffHeader({
  name,
  code,
  photo,
  unread,
  onBell,
  onSettings,
  onMenu,
  onProfile,
  light,
}: {
  name: string
  code?: string
  photo?: string
  unread?: number
  onBell: () => void
  onSettings: () => void
  /** The design's ☰ that opens the side menu (Clinic app). */
  onMenu?: () => void
  onProfile?: () => void
  light?: boolean
}) {
  const insets = useSafeAreaInsets()
  return (
    <View testID="staff-header" style={[styles.wrap, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.row}>
        {onProfile ? (
          <Pressable testID="open-profile" accessibilityRole="button" accessibilityLabel="My profile" onPress={onProfile}>
            <Avatar name={name} uri={photo} size={48} />
          </Pressable>
        ) : (
          <Avatar name={name} uri={photo} size={48} />
        )}
        <View style={styles.who}>
          <Text style={[styles.hello, light && { fontFamily: 'LeagueSpartan-Light' }]}>Hi, WelcomeBack</Text>
          <Text numberOfLines={1} style={[styles.name, light && { fontFamily: 'LeagueSpartan-Regular' }]}>{name}</Text>
          {!!code && <Text numberOfLines={1} style={[styles.code, light && { fontFamily: 'LeagueSpartan-Regular' }]}>{code}</Text>}
        </View>
        <IconButton testID="open-notifications" icon="bell" label="Notifications" badge={unread} color={colors.title} onPress={onBell} />
        <IconButton testID="open-settings" icon="settings" label="Settings" color={colors.title} onPress={onSettings} />
        {onMenu && <IconButton testID="open-menu" icon="menu" label="Menu" color={colors.title} onPress={onMenu} />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, paddingBottom: space.sm },
  row: { width: '100%', maxWidth: 640, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  who: { flex: 1, minWidth: 0 },
  hello: { fontFamily: 'LeagueSpartan-Bold', fontSize: 12, lineHeight: 15, color: colors.brand600 },
  name: { fontFamily: 'LeagueSpartan-Bold', fontSize: 15, lineHeight: 19, color: '#000000' },
  code: { fontFamily: 'LeagueSpartan-Bold', fontSize: 11, lineHeight: 14, color: '#000000' },
})
