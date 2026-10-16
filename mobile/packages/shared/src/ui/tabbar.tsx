import { Feather, MaterialDesignIcons } from './icons'
import type { ComponentProps } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, shadow, face } from '../theme'
import type { IconName } from './primitives'

export interface TabItem {
  /** Route name inside the tabs folder, e.g. "index" or "appointments". */
  name: string
  label: string
  icon: IconName
  /** A Material Design icon instead of the Feather one, where the design uses those. */
  mdi?: ComponentProps<typeof MaterialDesignIcons>['name']
  badge?: number
}

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] }
  navigation: { emit: (e: any) => any; navigate: (name: string, params?: any) => void }
  items: TabItem[]
  /** Optional raised action in the middle of the bar (e.g. "Book"). */
  center?: { icon: IconName; label: string; onPress: () => void }
  /** The tab drawn as the raised round button in the middle (it must be the middle item). */
  raised?: string
  labels?: boolean
  /** The designs' floating rounded bar of icons (the staff apps). */
  pill?: boolean
}

/**
 * Bottom navigation in the brand colour, with an optional raised centre action.
 * Only the routes listed in `items` get a button; other routes in the folder stay reachable
 * without appearing in the bar. Height includes the device's bottom safe area.
 */
export function BottomBar({ state, navigation, items, center, raised, labels = true, pill }: TabBarProps) {
  const insets = useSafeAreaInsets()
  const active = state.routes[state.index]?.name
  const half = Math.ceil(items.length / 2)
  const slots: (TabItem | 'center')[] = center ? [...items.slice(0, half), 'center', ...items.slice(half)] : items

  const go = (item: TabItem) => {
    const route = state.routes.find((r) => r.name === item.name)
    if (!route) return
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
    if (active !== item.name && !event?.defaultPrevented) navigation.navigate(item.name)
  }

  if (pill) {
    return (
      <View style={[styles.pillWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.pill}>
          {items.map((slot) => {
            const on = active === slot.name
            return (
              <Pressable
                key={slot.name}
                testID={`tab-${slot.name}`}
                accessibilityRole="tab"
                accessibilityLabel={slot.label}
                accessibilityState={{ selected: on }}
                onPress={() => go(slot)}
                style={({ pressed }) => [styles.pillSlot, pressed && { opacity: 0.7 }]}
              >
                {slot.mdi ? <MaterialDesignIcons name={slot.mdi} size={24} color={colors.accent} /> : <Feather name={slot.icon} size={21} color={colors.accent} />}
                {!!slot.badge && <View style={styles.badge}><Text style={styles.badgeText}>{slot.badge > 9 ? '9+' : slot.badge}</Text></View>}
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }

  // A raised tab rises 34 pt above the bar. That band is kept free of page content (it shows
  // the page colour), so nothing on the page can sit under the round button and lose its taps.
  const lift = raised ? <View style={styles.lift} /> : null
  return (
    <View>
      {lift}
      <View style={[styles.bar, !labels && styles.iconBar, { paddingBottom: Math.max(insets.bottom, labels ? 6 : 10) }]}>
        {slots.map((slot) => {
          if (slot === 'center') {
            return (
              <View key="center" style={styles.slot}>
                <Pressable
                  testID="tab-center"
                  accessibilityRole="button"
                  accessibilityLabel={center!.label}
                  onPress={center!.onPress}
                  style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.95 }] }]}
                >
                  <Feather name={center!.icon} size={24} color={colors.header} />
                </Pressable>
                <Text numberOfLines={1} style={[styles.label, { color: colors.onBrand, marginTop: 30 }]}>{center!.label}</Text>
              </View>
            )
          }
          const on = active === slot.name
          const icon = (color: string, size: number) =>
            slot.mdi ? <MaterialDesignIcons name={slot.mdi} size={size + 4} color={color} /> : <Feather name={slot.icon} size={size} color={color} />
          if (slot.name === raised) {
            return (
              <View key={slot.name} style={styles.slot}>
                <Pressable
                  testID={`tab-${slot.name}`}
                  accessibilityRole="tab"
                  accessibilityLabel={slot.label}
                  accessibilityState={{ selected: on }}
                  onPress={() => go(slot)}
                  style={({ pressed }) => [styles.raised, pressed && { transform: [{ scale: 0.95 }] }]}
                >
                  {icon(colors.accent, 26)}
                </Pressable>
              </View>
            )
          }
          return (
            <Pressable
              key={slot.name}
              testID={`tab-${slot.name}`}
              accessibilityRole="tab"
              accessibilityLabel={slot.label}
              accessibilityState={{ selected: on }}
              onPress={() => go(slot)}
              style={styles.slot}
            >
              <View>
                {icon(on ? colors.headerText : colors.barMuted, 22)}
                {!!slot.badge && <View style={styles.badge}><Text style={styles.badgeText}>{slot.badge > 9 ? '9+' : slot.badge}</Text></View>}
              </View>
              {labels && <Text numberOfLines={1} style={[styles.label, { color: on ? colors.headerText : colors.barMuted, ...face(on ? 'bold' : 'medium') }]}>{slot.label}</Text>}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.header, paddingTop: 8, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  // Icons only: the designs' taller bar with rounder corners.
  iconBar: { paddingTop: 16, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  lift: { height: 34, backgroundColor: colors.bg },
  // The staff designs: a 298 x 37 rounded bar (radius 24) floating over the page, icons only.
  // It is 46 pt tall here so every icon keeps a comfortable touch target.
  pillWrap: { backgroundColor: colors.surface, paddingTop: 6, alignItems: 'center' },
  pill: { flexDirection: 'row', width: '84%', maxWidth: 420, height: 46, borderRadius: 24, backgroundColor: colors.header, alignItems: 'center', paddingHorizontal: 12 },
  pillSlot: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  raised: {
    position: 'absolute', top: -34, width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: colors.header,
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 3, minHeight: 48 },
  label: { fontSize: 11, lineHeight: 14 },
  fab: {
    position: 'absolute', top: -26, width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.header, ...shadow,
  },
  badge: { position: 'absolute', top: -5, right: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 9, ...face('bold') },
})
