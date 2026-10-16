import { Feather, colors, face, imageSource, space, useRouter } from '@dentor/shared'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import logo from '@/assets/design/logo-on-red.png'
import { can } from '@/lib/access'
import { MENU, type MenuEntry } from '@/lib/menu'

/**
 * The design's side menu (dentor.fig "Home menu" 3624:2263): the DENTOR logo on top, one pill row
 * per entry with a red icon and an arrow, and a red footer with the clinic and a sign-out button.
 * Entries the signed-in role may not use are left out.
 */
export function SideMenu({
  visible,
  onClose,
  role,
  clinicName,
  clinicPhone,
  onSignOut,
}: {
  visible: boolean
  onClose: () => void
  role?: string
  clinicName?: string
  clinicPhone?: string
  onSignOut: () => void
}) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const open = (entry: MenuEntry) => {
    onClose()
    router.push(entry.href)
  }
  const rows = MENU.filter((entry) => can(role, entry.area))
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable testID="menu-close" style={styles.veil} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close the menu" />
      <View testID="side-menu" style={[styles.panel, { paddingTop: insets.top + space.md, paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <View style={styles.logoBox}>
          <Image source={imageSource(logo)} style={styles.logo} resizeMode="contain" accessibilityLabel="DENTOR" />
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {rows.map((entry) => (
            <View key={entry.key}>
              <Row entry={entry} onPress={() => open(entry)} />
              {entry.children?.filter((child) => can(role, child.area)).map((child) => (
                <Row key={child.key} entry={child} onPress={() => open(child)} child />
              ))}
            </View>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <View style={styles.footerText}>
            <Text numberOfLines={1} style={styles.clinic}>{clinicName ?? 'Your clinic'}</Text>
            {!!clinicPhone && <Text numberOfLines={1} style={styles.phone}>{clinicPhone}</Text>}
          </View>
          <Pressable testID="menu-sign-out" accessibilityRole="button" accessibilityLabel="Sign out" hitSlop={8} onPress={() => { onClose(); onSignOut() }}>
            <Feather name="log-out" size={22} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function Row({ entry, onPress, child }: { entry: MenuEntry; onPress: () => void; child?: boolean }) {
  return (
    <Pressable
      testID={`menu-${entry.key}`}
      accessibilityRole="button"
      accessibilityLabel={entry.label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, child && styles.child, pressed && { opacity: 0.8 }]}
    >
      <Feather name={entry.icon} size={16} color={colors.header} />
      <Text numberOfLines={1} style={styles.label}>{entry.label}</Text>
      <Feather name="chevron-right" size={16} color="#8c8686" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  panel: {
    position: 'absolute', top: 0, bottom: 0, right: 0, width: '80%', maxWidth: 330, backgroundColor: '#ffffff',
    borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
  },
  logoBox: { alignItems: 'center', paddingBottom: space.md },
  logo: { width: 150, height: 58 },
  list: { gap: 8, paddingHorizontal: space.md, paddingBottom: space.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40, paddingHorizontal: space.md,
    borderRadius: 8, borderWidth: 0.5, borderColor: '#bdbcbc', backgroundColor: '#ffffff',
    shadowColor: '#000000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  child: { marginLeft: space.xl, marginTop: 6, minHeight: 34 },
  label: { flex: 1, ...face('medium'), fontSize: 13, lineHeight: 18, color: '#000000' },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, marginHorizontal: space.md, padding: space.md,
    borderRadius: 10, backgroundColor: colors.header,
  },
  footerText: { flex: 1, minWidth: 0 },
  clinic: { ...face('bold'), fontSize: 14, lineHeight: 19, color: '#ffffff' },
  phone: { ...face('regular'), fontSize: 12, lineHeight: 16, color: '#ffffff' },
})
