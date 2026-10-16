import { colors, font, radius, space } from '@dentor/shared'
import { type ComponentRef, useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'

/**
 * Section switcher for screens with more sections than fit side by side on a phone: the row
 * scrolls sideways instead of squeezing the labels. It runs to the screen edges (it expects
 * to sit in a `Screen` with the standard padding), so a tab cut off at the edge shows there
 * is more to scroll to, and the chosen tab is brought fully into view.
 */
export function ScrollTabs<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string; count?: number }[]
  value: K
  onChange: (key: K) => void
}) {
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null)
  const offsets = useRef<Partial<Record<K, number>>>({})
  const choose = (key: K) => {
    onChange(key)
    const x = offsets.current[key]
    // Leave the previous tab peeking in on the left, so both directions stay discoverable.
    if (x !== undefined) scroller.current?.scrollTo({ x: Math.max(0, x - PEEK), animated: true })
  }
  return (
    <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroller}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <Pressable
            key={o.key}
            testID={`segment-${o.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onLayout={(e) => {
              offsets.current[o.key] = e.nativeEvent.layout.x
            }}
            onPress={() => choose(o.key)}
            style={[styles.tab, on && styles.tabOn]}
          >
            <Text numberOfLines={1} style={[font.smallStrong, { color: on ? colors.onBrand : colors.textMuted }]}>
              {o.label}
              {o.count !== undefined ? ` ${o.count}` : ''}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const PEEK = 56

const styles = StyleSheet.create({
  scroller: { flexGrow: 0, marginHorizontal: -space.lg },
  row: { gap: space.sm, paddingHorizontal: space.lg },
  tab: {
    minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  tabOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
})
