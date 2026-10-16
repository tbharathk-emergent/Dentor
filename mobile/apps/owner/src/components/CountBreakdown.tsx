import { Badge, ProgressBar, T, colors, space, statusTone, type Tone } from '@dentor/shared'
import { View } from 'react-native'
import { slug } from '@/lib/format'

/**
 * Counts per status or stage, each with its share of the total. `order` lists the names in
 * workflow order; names the API adds later are shown after them.
 */
export function CountBreakdown({
  counts,
  order = [],
  toneOf = statusTone,
  emptyText,
  testID,
}: {
  counts: Record<string, number>
  order?: string[]
  /** The colour of a name; statuses by default. */
  toneOf?: (name: string) => Tone
  emptyText: string
  testID: string
}) {
  const rank = (name: string) => {
    const index = order.indexOf(name)
    return index === -1 ? order.length : index
  }
  const rows = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
  const total = rows.reduce((sum, [, count]) => sum + count, 0)

  if (rows.length === 0) {
    return (
      <T variant="small" color={colors.textMuted} testID={`${testID}-empty`}>
        {emptyText}
      </T>
    )
  }
  return (
    <View testID={testID} style={{ gap: space.md }}>
      {rows.map(([name, count]) => (
        <View key={name} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
            <Badge label={name} tone={toneOf(name)} />
            <T variant="bodyStrong" testID={`${testID}-${slug(name)}`}>
              {count}
            </T>
          </View>
          <ProgressBar value={count} max={total} tone={toneOf(name)} />
        </View>
      ))}
    </View>
  )
}
