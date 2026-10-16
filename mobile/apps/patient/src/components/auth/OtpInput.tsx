import { T, colors, font, radius, space } from '@dentor/shared'
import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

export const OTP_LENGTH = 6

/**
 * Six boxes backed by one real text field laid over them, so paste, SMS autofill and
 * the backspace key behave the way the keyboard expects.
 */
export function OtpInput({
  value,
  onChange,
  onSubmit,
  invalid,
  testID,
}: {
  value: string
  onChange: (code: string) => void
  onSubmit?: () => void
  invalid?: boolean
  testID?: string
}) {
  const [focused, setFocused] = useState(false)
  const cursor = Math.min(value.length, OTP_LENGTH - 1)
  return (
    <View style={styles.wrap}>
      <View style={styles.boxes}>
        {Array.from({ length: OTP_LENGTH }, (_, i) => (
          <View key={i} style={[styles.box, focused && i === cursor && styles.boxActive, invalid && styles.boxInvalid]}>
            <T variant="h2">{value[i] ?? ''}</T>
          </View>
        ))}
      </View>
      <TextInput
        testID={testID}
        accessibilityLabel="Verification code"
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        returnKeyType="done"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        autoFocus
        caretHidden
        selectionColor="transparent"
        style={styles.input}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  boxes: { flexDirection: 'row', gap: space.sm },
  box: {
    flex: 1, height: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  boxActive: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  boxInvalid: { borderColor: colors.red },
  // Invisible but on top: it takes the taps and the typing, the boxes show the digits.
  input: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, ...font.h2, color: 'transparent', outlineWidth: 0 },
})
