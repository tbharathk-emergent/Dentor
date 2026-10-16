import { EmptyState, T, addDays, colors, fmtDate, space, toISODate, todayISO } from '@dentor/shared'
import { Fragment } from 'react'
import { StyleSheet, View } from 'react-native'
import { MessageBubble } from '@/components/chat/MessageBubble'
import type { ChatMessage } from '@/types'

/** The local calendar day a message was sent on, or '' when the message carries no timestamp. */
function dayOf(message: ChatMessage): string {
  const sent = message.at ? new Date(message.at) : null
  return sent && !Number.isNaN(sent.getTime()) ? toISODate(sent) : ''
}

function dayLabel(day: string): string {
  const today = todayISO()
  if (day === today) return 'Today'
  if (day === addDays(today, -1)) return 'Yesterday'
  return fmtDate(day)
}

/** The thread, oldest first, with a label wherever the day changes. */
export function MessageList({ messages, clinicName }: { messages: ChatMessage[]; clinicName: string }) {
  if (messages.length === 0) {
    return (
      <View style={styles.empty}>
        <EmptyState
          testID="chat-empty"
          title={`Message ${clinicName || 'your clinic'}`}
          message="Ask the front desk about appointments, bills or anything else. Replies appear here. For urgent problems, please call the clinic."
        />
      </View>
    )
  }

  let lastDay = ''
  return (
    <>
      {messages.map((message, index) => {
        const day = dayOf(message)
        const newDay = !!day && day !== lastDay
        if (day) lastDay = day
        return (
          <Fragment key={`${message.at}-${index}`}>
            {newDay && <T variant="tiny" color={colors.textMuted} center style={styles.day}>{dayLabel(day)}</T>}
            <MessageBubble message={message} />
          </Fragment>
        )
      })}
    </>
  )
}

const styles = StyleSheet.create({
  empty: { flexGrow: 1, justifyContent: 'center' },
  day: { marginVertical: space.xs },
})
