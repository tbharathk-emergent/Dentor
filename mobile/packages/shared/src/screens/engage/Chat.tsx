import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { api, errorMessage } from '../../api'
import { fmtDateTime, timeAgo } from '../../format'
import { useLocalSearchParams, useRouter } from '../../navigation'
import { colors, face, radius, space, stripeColors } from '../../theme'
import { ListRow, Screen } from '../../ui/layout'
import { Badge, Banner, Button, Chip, Row, T, TextField } from '../../ui/primitives'
import { EmptyState, QueryState } from '../../ui/states'

interface Thread {
  id: string
  side: 'clinic' | 'consultant'
  consultant: string
  subject: string
  last: string
  last_at: string
  unread: number
  messages: { from: 'clinic' | 'consultant'; name: string; text: string; at: string }[]
}

/** "Chat" (dentor.fig 229, 232, 344, 347): conversations between the clinic and its consultants. */
export function ChatListScreen() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [writing, setWriting] = useState(false)
  const list = useQuery<{ items: Thread[]; consultants: { id: string; name: string; specialty: string }[]; side: 'clinic' | 'consultant' }>({
    queryKey: ['engage', 'chats'], queryFn: () => api.get('/api/engage/chats'), refetchInterval: 30000,
  })
  return (
    <Screen testID="chat-list-screen" title="Chat" back footer={<Button testID="chat-new" label="New message" icon="edit" size="lg" full onPress={() => setWriting(true)} />}>
      <TextField testID="chat-search" icon="search" value={q} onChangeText={setQ} placeholder="Search..." autoCapitalize="none" />
      <QueryState query={list}>
        {(data) => {
          const items = data.items.filter((t) => !q || `${t.consultant} ${t.subject}`.toLowerCase().includes(q.toLowerCase()))
          return (
            <>
              {writing && <NewChat side={data.side} consultants={data.consultants} onClose={() => setWriting(false)} onStarted={(id) => { setWriting(false); router.push({ pathname: '/chat/[id]', params: { id } }) }} />}
              {items.length ? (
                <View style={{ gap: space.md }}>
                  {items.map((t, i) => (
                    <ListRow key={t.id} stripe={stripeColors.cycle[i % stripeColors.cycle.length]} testID={`chat-${t.id}`} title={data.side === 'clinic' ? t.consultant : t.subject} subtitle={`Case: ${t.subject} · ${t.last}`} meta={timeAgo(t.last_at)}
                      right={t.unread ? <Badge label={String(t.unread)} tone="red" /> : undefined} chevron onPress={() => router.push({ pathname: '/chat/[id]', params: { id: t.id } })} />
                  ))}
                </View>
              ) : !writing ? <EmptyState icon="message-circle" title="No conversations yet" message={data.side === 'clinic' ? 'Message a consultant about a case.' : 'Message the clinic about a case.'} /> : null}
            </>
          )
        }}
      </QueryState>
    </Screen>
  )
}

function NewChat({ side, consultants, onClose, onStarted }: { side: string; consultants: { id: string; name: string }[]; onClose: () => void; onStarted: (id: string) => void }) {
  const queryClient = useQueryClient()
  const [consultant, setConsultant] = useState('')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const start = useMutation({ mutationFn: () => api.post<Thread>('/api/engage/chats', { consultant_id: consultant, subject: subject.trim(), text: text.trim() }) })
  return (
    <View testID="chat-compose" style={styles.compose}>
      {side === 'clinic' && <Row wrap gap={space.xs}>{consultants.map((c) => <Chip key={c.id} testID={`chat-to-${c.name}`} label={c.name} selected={consultant === c.id} onPress={() => setConsultant(c.id)} />)}</Row>}
      <TextField testID="chat-subject" label="Treatment name, patient…" value={subject} onChangeText={setSubject} maxLength={120} />
      <TextField testID="chat-first" label="Message" value={text} onChangeText={setText} multiline maxLength={2000} />
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
      <Row gap={space.sm}>
        <Button testID="chat-start" label="Send" loading={start.isPending} onPress={() => {
          if (side === 'clinic' && !consultant) return setError('Choose the consultant.')
          if (!text.trim()) return setError('Write a message.')
          start.mutate(undefined, { onSuccess: (t) => { void queryClient.invalidateQueries({ queryKey: ['engage', 'chats'] }); onStarted(t.id) }, onError: (e) => setError(errorMessage(e)) })
        }} />
        <Button label="Cancel" variant="ghost" onPress={onClose} />
      </Row>
    </View>
  )
}

export function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const thread = useQuery<Thread>({ queryKey: ['engage', 'chat', id], queryFn: () => api.get(`/api/engage/chats/${id}`), refetchInterval: 15000 })
  const send = useMutation({ mutationFn: () => api.post<Thread>(`/api/engage/chats/${id}/messages`, { text: text.trim() }) })
  const mine = (from: string) => from === thread.data?.side
  return (
    <Screen testID="chat-screen" title={thread.data ? `${thread.data.consultant}` : 'Chat'} subtitle={thread.data?.subject} back scroll={false}
      footer={
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}><TextField testID="chat-input" value={text} onChangeText={setText} placeholder="Message here" multiline maxLength={2000} /></View>
          <Button testID="chat-send" label="Send" loading={send.isPending} onPress={() => text.trim() && send.mutate(undefined, {
            onSuccess: (t) => { setText(''); queryClient.setQueryData(['engage', 'chat', id], t); void queryClient.invalidateQueries({ queryKey: ['engage', 'chats'] }) },
          })} />
        </View>
      }>
      <QueryState query={thread}>
        {(t) => (
          <ScrollView contentContainerStyle={{ gap: space.sm, paddingVertical: space.sm }}>
            {t.messages.map((m, i) => (
              <View key={i} testID={`message-${i}`} style={[styles.bubble, mine(m.from) ? styles.mine : styles.theirs]}>
                <Text style={[styles.text, mine(m.from) && { color: '#ffffff' }]}>{m.text}</Text>
                <T variant="tiny" color={mine(m.from) ? '#ffffffcc' : colors.textMuted}>{`${m.name} · ${fmtDateTime(m.at)}`}</T>
              </View>
            ))}
            {!t.messages.length && <EmptyState icon="message-circle" title="No messages" />}
          </ScrollView>
        )}
      </QueryState>
    </Screen>
  )
}

const styles = StyleSheet.create({
  compose: { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  bubble: { maxWidth: '82%', padding: space.md, borderRadius: radius.lg, gap: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.header, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.slateBg, borderBottomLeftRadius: 4 },
  text: { ...face('regular'), fontSize: 15, lineHeight: 21, color: colors.text },
})
