import { T, colors, radius, space, face } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import type { ChatMessage } from '@/types'

/** One message: the patient's on the right in the brand colour, the clinic's on the left. */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const mine = message.mine
  return (
    <View
      testID={mine ? 'message-mine' : 'message-clinic'}
      style={[styles.bubble, mine ? styles.mine : styles.theirs, message.pending && styles.pending]}
    >
      <T color={mine ? colors.onBrand : colors.text}>{message.text}</T>
      <T variant="tiny" color={mine ? colors.brand100 : colors.textFaint} style={styles.time}>
        {message.pending ? 'Sending…' : message.time}
      </T>
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '84%', paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.lg, gap: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.brand700, borderBottomRightRadius: radius.sm },
  theirs: {
    alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
  },
  pending: { opacity: 0.6 },
  time: { alignSelf: 'flex-end', ...face('medium') },
})
