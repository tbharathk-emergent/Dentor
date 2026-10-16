import { Feather } from './icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { accentColors, colors, font, radius, shadow, space, toneColors, type Tone, face } from '../theme'
import type { IconName } from './primitives'

/** KPI tile for dashboards. */
export function StatTile({ label, value, hint, icon, tone = 'brand', onPress, testID }: { label: string; value: string | number; hint?: string; icon?: IconName; tone?: Tone; onPress?: () => void; testID?: string }) {
  const c = accentColors[tone]
  const inner = (
    <>
      {icon && (
        <View style={[styles.tileIcon, { backgroundColor: c.bg }]}><Feather name={icon} size={18} color={c.fg} /></View>
      )}
      <Text testID={testID ? `${testID}-value` : undefined} numberOfLines={1} adjustsFontSizeToFit style={[font.h2, { color: colors.textStrong }]}>{value}</Text>
      <Text numberOfLines={1} style={[font.small, { color: colors.textMuted, ...face('medium') }]}>{label}</Text>
      {!!hint && <Text numberOfLines={1} style={[font.tiny, { color: colors.textFaint, ...face('medium') }]}>{hint}</Text>}
    </>
  )
  if (!onPress) return <View testID={testID} style={styles.tile}>{inner}</View>
  return <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}>{inner}</Pressable>
}

/** Two tiles per row on phones, wrapping automatically. */
export function TileGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>
}

export function ProgressBar({ value, max, tone = 'brand' }: { value: number; max: number; tone?: Tone }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0
  return (
    <View style={styles.track}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: tone === 'brand' ? colors.brand600 : toneColors[tone].fg }} />
    </View>
  )
}

/** A ranked list with proportional bars, e.g. revenue by doctor. */
export function BarList({ rows, format = (n) => String(n), tone = 'brand' }: { rows: { label: string; value: number; hint?: string }[]; format?: (n: number) => string; tone?: Tone }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <View style={{ gap: space.md }}>
      {rows.map((r) => (
        <View key={r.label} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
            <Text numberOfLines={1} style={[font.small, { color: colors.text, ...face('medium'), flex: 1 }]}>{r.label}</Text>
            <Text style={[font.smallStrong, { color: colors.text }]}>{format(r.value)}</Text>
          </View>
          <ProgressBar value={r.value} max={max} tone={tone} />
          {!!r.hint && <Text style={[font.tiny, { color: colors.textFaint, ...face('medium') }]}>{r.hint}</Text>}
        </View>
      ))}
    </View>
  )
}

/** Compact column chart for a short daily series. */
export function MiniBars({ data, height = 96, format = (n) => String(n) }: { data: { label: string; value: number }[]; height?: number; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0] ?? { label: '', value: 0 })
  const step = Math.max(1, Math.ceil(data.length / 6))
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: data.length > 20 ? 2 : 4 }}>
        {data.map((d, i) => (
          <View key={`${d.label}-${i}`} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
            <View
              accessibilityLabel={`${d.label}: ${format(d.value)}`}
              style={{ height: `${Math.max(d.value > 0 ? 4 : 1.5, (d.value / max) * 100)}%`, borderRadius: 3, backgroundColor: d.value > 0 ? colors.brand600 : colors.border }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {data.filter((_, i) => i % step === 0).map((d, i) => (
          <Text key={`${d.label}-${i}`} style={[font.tiny, { color: colors.textFaint, ...face('medium') }]}>{d.label}</Text>
        ))}
      </View>
      {peak && peak.value > 0 && (
        <Text style={[font.tiny, { color: colors.textMuted, ...face('medium') }]}>Peak {format(peak.value)} on {peak.label}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { flexBasis: '47%', flexGrow: 1, minWidth: 140, gap: 2, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  tileIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.slateBg, overflow: 'hidden' },
})
