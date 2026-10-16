import { useRef } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native'
import { colors, face, space } from '../theme'

/**
 * The designs' code entry: four boxes (dentor.fig "Enter Verification Code" pop-ups). One hidden
 * text field takes the typing, so paste and the keyboard's one-time-code suggestion work.
 */
export function CodeInput({ value, onChange, length = 4, error, testID = 'code-input' }: {
  value: string
  onChange: (next: string) => void
  length?: number
  error?: string
  testID?: string
}) {
  const input = useRef<TextInputInstance>(null)
  return (
    <View style={{ gap: space.sm }}>
      <Pressable accessibilityRole="none" onPress={() => input.current?.focus()} style={styles.row}>
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.box, !!error && { borderColor: colors.red }, i === value.length && styles.current]}>
            <Text style={styles.digit}>{value[i] ?? ''}</Text>
          </View>
        ))}
        <TextInput
          ref={input}
          testID={testID}
          accessibilityLabel="Verification code"
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          autoFocus
          style={styles.hidden}
        />
      </Pressable>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: space.md },
  box: { width: 52, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: colors.fieldBorder, backgroundColor: colors.fieldBg, alignItems: 'center', justifyContent: 'center' },
  current: { borderColor: colors.header },
  digit: { ...face('semibold'), fontSize: 24, lineHeight: 30, color: colors.textStrong },
  // Covers the boxes so a tap anywhere focuses it; the text itself is invisible.
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent', fontSize: 1 },
  error: { ...face('regular'), fontSize: 13, lineHeight: 18, color: colors.red, textAlign: 'center' },
})
