import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, font, space } from '../theme'
import { Icon, type IconName } from './primitives'

export interface MenuRow {
  key: string
  title: string
  subtitle?: string
  icon: IconName
  /** Red icon and title for actions that remove something. */
  danger?: boolean
  /** Shown on the right before the chevron, e.g. an unread count. */
  right?: React.ReactNode
  /** Defaults to `menu-<key>`. */
  testID?: string
  onPress: () => void
}

/**
 * Settings-style rows as all three app designs draw them (patient-app.fig "Profile" 95:430,
 * dentor.fig "Profile" 5422:5948 and 12:5): a 40 pt round icon in the header colour, the
 * label in JetBrains Mono, a chevron in the same colour, no card or dividers.
 */
export function MenuRows({ items, size = 18 }: { items: MenuRow[]; size?: 18 | 20 }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          testID={item.testID ?? `menu-${item.key}`}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          onPress={item.onPress}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.icon, { backgroundColor: item.danger ? colors.red : colors.header }]}>
            <Icon name={item.icon} size={19} color="#ffffff" />
          </View>
          <View style={styles.text}>
            <Text numberOfLines={1} style={[styles.title, { fontSize: size, lineHeight: size + 6 }, item.danger && { color: colors.red }]}>{item.title}</Text>
            {!!item.subtitle && <Text numberOfLines={1} style={[font.small, { color: colors.textMuted }]}>{item.subtitle}</Text>}
          </View>
          {item.right}
          <Icon name="chevron-right" size={22} color={colors.header} />
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: 56, paddingVertical: space.xs },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: 'JetBrainsMono-Regular', color: '#000000' },
})
