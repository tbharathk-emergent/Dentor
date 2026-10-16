import { Icon, TOUCH, colors, radius, space } from '@dentor/shared'
import { useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'

const MAX_LENGTH = 1000
const MIN_HEIGHT = TOUCH
const MAX_HEIGHT = 120

/** Message box that grows with the text, and a send button that is off until there is something to send. */
export function Composer({
  value,
  onChange,
  onSend,
  sending,
}: {
  value: string
  onChange: (text: string) => void
  onSend: () => void
  sending: boolean
}) {
  // Devices grow a multiline field by themselves; a browser needs to be told its height.
  const [webHeight, setWebHeight] = useState(MIN_HEIGHT)
  const ready = value.trim().length > 0 && !sending
  return (
    <View style={styles.row}>
      <TextInput
        testID="chat-input"
        accessibilityLabel="Message"
        value={value}
        onChangeText={onChange}
        placeholder="Write a message"
        placeholderTextColor={colors.textFaint}
        multiline
        maxLength={MAX_LENGTH}
        onContentSizeChange={(event) => setWebHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, event.nativeEvent.contentSize.height)))}
        style={[styles.input, Platform.OS === 'web' && { height: value ? webHeight : MIN_HEIGHT }]}
      />
      <Pressable
        testID="chat-send"
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !ready, busy: sending }}
        disabled={!ready}
        onPress={onSend}
        style={[styles.send, !ready && styles.sendOff]}
      >
        {sending ? <ActivityIndicator size="small" color={colors.onBrand} /> : <Icon name="send" size={20} color={colors.onBrand} />}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  // 16px keeps iOS Safari from zooming the page when the field is focused.
  input: {
    flex: 1, minWidth: 0, minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT, fontSize: 16, lineHeight: 20, color: colors.text,
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.xl, backgroundColor: colors.bg, outlineWidth: 0,
  },
  send: { width: TOUCH, height: TOUCH, borderRadius: radius.pill, backgroundColor: colors.brand700, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.45 },
})
