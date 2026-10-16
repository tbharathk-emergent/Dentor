import { Chip, colors, space, T } from '@dentor/shared'
import { View } from 'react-native'

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Pick one of a few options. Chips wrap, so the group fits any width. */
export function ChipGroup<V extends string>({
  label,
  options,
  value,
  onChange,
  hint,
  testID,
}: {
  label?: string
  options: readonly V[] | { value: V; label: string }[]
  value: V | ''
  onChange: (value: V) => void
  hint?: string
  /** Each chip gets `${testID}-${slug(value)}`. */
  testID: string
}) {
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <View style={{ gap: 6 }}>
      {!!label && <T variant="smallStrong">{label}</T>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {items.map((o) => (
          <Chip key={o.value} testID={`${testID}-${slug(o.value)}`} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
        ))}
      </View>
      {!!hint && <T variant="small" color={colors.textMuted}>{hint}</T>}
    </View>
  )
}
