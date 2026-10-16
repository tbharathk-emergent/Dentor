import { Badge, colors, Divider, radius, space, T, TextField, type Tone } from '@dentor/shared'
import { Fragment, useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

export interface Suggestion {
  name: string
  /** Shown under the name, e.g. the form of a medicine or the list price of a treatment. */
  detail?: string
  flag?: { label: string; tone: Tone }
}

const MAX_SHOWN = 5

/**
 * A text field that offers matching names from a catalogue while the user types.
 * Anything may be typed: the suggestions are a shortcut, not a restriction.
 */
export function SuggestField<S extends Suggestion>({
  label,
  value,
  onChangeText,
  onPick,
  suggestions,
  placeholder,
  error,
  hint,
  required,
  maxLength,
  testID,
}: {
  label: string
  value: string
  onChangeText: (text: string) => void
  /** Called with the chosen suggestion (after `onChangeText(name)`). */
  onPick?: (suggestion: S) => void
  suggestions: S[]
  placeholder?: string
  error?: string
  hint?: string
  required?: boolean
  maxLength?: number
  testID: string
}) {
  // Open while typing; closed again once a suggestion is picked.
  const [open, setOpen] = useState(false)
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    const found = suggestions.filter((s) => s.name.toLowerCase().includes(q))
    // Names that start with the text first, then names that merely contain it.
    found.sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)))
    return found.slice(0, MAX_SHOWN)
  }, [suggestions, value])
  const exact = matches.length === 1 && matches[0].name.toLowerCase() === value.trim().toLowerCase()

  return (
    <View style={{ gap: space.sm }}>
      <TextField
        testID={testID}
        label={label}
        required={required}
        value={value}
        onChangeText={(text) => {
          setOpen(true)
          onChangeText(text)
        }}
        placeholder={placeholder}
        error={error}
        hint={hint}
        maxLength={maxLength}
        autoCapitalize="words"
      />
      {open && matches.length > 0 && !exact && (
        <View testID={`${testID}-suggestions`} style={styles.list}>
          {matches.map((s, i) => (
            <Fragment key={s.name}>
              {i > 0 && <Divider />}
              <Pressable
                testID={`${testID}-suggestion-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`Use ${s.name}`}
                onPress={() => {
                  setOpen(false)
                  onChangeText(s.name)
                  onPick?.(s)
                }}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.slateBg }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T variant="bodyStrong" numberOfLines={1}>{s.name}</T>
                  {!!s.detail && <T variant="small" color={colors.textMuted} numberOfLines={1}>{s.detail}</T>}
                </View>
                {s.flag && <Badge label={s.flag.label} tone={s.flag.tone} />}
              </Pressable>
            </Fragment>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingHorizontal: space.md, paddingVertical: space.sm },
})
