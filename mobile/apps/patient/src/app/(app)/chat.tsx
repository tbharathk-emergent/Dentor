import { HeaderAction, QueryState, useToast } from '@dentor/shared'
import { useCallback, useState } from 'react'
import { Composer } from '@/components/chat/Composer'
import { MessageList } from '@/components/chat/MessageList'
import { ThreadFrame } from '@/components/chat/ThreadFrame'
import { useChat, useSendMessage } from '@/hooks/useChat'
import { useContact } from '@/hooks/useContact'
import { useFocusEffect } from '@/nav'

export default function Chat() {
  const toast = useToast()
  const contact = useContact()
  const [inFront, setInFront] = useState(false)
  const chat = useChat(inFront)
  const send = useSendMessage()
  const [text, setText] = useState('')

  // Poll only while the patient is looking at the thread.
  useFocusEffect(
    useCallback(() => {
      setInFront(true)
      return () => setInFront(false)
    }, []),
  )

  const submit = () => {
    const message = text.trim()
    if (!message || send.isPending) return
    setText('')
    send.mutate(message, {
      onError: (error) => {
        // The bubble has been taken back; give the words back too.
        setText(message)
        toast.error(error, 'Your message was not sent. Please try again.')
      },
    })
  }

  const phone = chat.data?.clinic.phone
  return (
    <ThreadFrame
      testID="chat-screen"
      title="Chat"
      subtitle={chat.data?.clinic.name ?? 'Your clinic'}
      right={phone ? <HeaderAction testID="chat-call" icon="phone" label="Call the clinic" onPress={() => contact.call(phone)} /> : undefined}
      composer={<Composer value={text} onChange={setText} onSend={submit} sending={send.isPending} />}
    >
      <QueryState query={chat}>{(data) => <MessageList messages={data.messages} clinicName={data.clinic.name} />}</QueryState>
    </ThreadFrame>
  )
}
