import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { View } from 'react-native'
import { api, errorMessage } from '../../api'
import { fmtDateTime } from '../../format'
import { useRouter } from '../../navigation'
import { colors, space, stripeColors } from '../../theme'
import { Sheet } from '../../ui/feedback'
import { ListRow, Screen, Section } from '../../ui/layout'
import { MascotDialog } from '../../ui/mascot'
import { Banner, Button, Chip, Row, Segmented, StatusBadge, T, TextField } from '../../ui/primitives'
import { EmptyState, QueryState } from '../../ui/states'

export interface Ticket {
  id: string
  code: string
  type: string
  subject: string
  description: string
  status: string
  created_at: string
  timeline: { status: string; at: string; by: string; text: string }[]
}

/**
 * "Ticket" (dentor.fig 276–280, 409–413): raise a ticket to Dentor's support, recent and previous tickets, the
 * details with what support said. "need Help?" opens the help centre.
 */
export function SupportScreen({ mascot }: { mascot: number | string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [scope, setScope] = useState<'open' | 'closed'>('open')
  const [raising, setRaising] = useState(false)
  const [open, setOpen] = useState<Ticket | null>(null)
  const [done, setDone] = useState(false)
  const list = useQuery<{ items: Ticket[]; types: string[] }>({ queryKey: ['engage', 'tickets', scope], queryFn: () => api.get(`/api/engage/tickets?scope=${scope}`) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['engage', 'tickets'] })
  return (
    <Screen testID="support-screen" title="Ticket" back footer={<Button testID="ticket-raise" label="Raise a Ticket" icon="plus" size="lg" full onPress={() => setRaising(true)} />}>
      <T variant="small" color={colors.textMuted}>Submit your queries for any assistance. Get in touch with tech support any time.</T>
      <Row gap={space.sm}>
        <Button testID="open-help" label="FAQ's" icon="help-circle" variant="secondary" onPress={() => router.push('/help')} />
        <Button label="Contact Support" icon="phone" variant="ghost" onPress={() => router.push({ pathname: '/help', params: { tab: 'contact' } })} />
      </Row>
      <Segmented options={[{ key: 'open', label: 'Recent Tickets' }, { key: 'closed', label: 'Previous Tickets' }]} value={scope} onChange={setScope} />
      <QueryState query={list}>
        {(data) => data.items.length ? (
          <View style={{ gap: space.md }}>
            {data.items.map((t) => (
              <ListRow key={t.id} stripe={['Resolved', 'Closed', 'Completed'].includes(t.status) ? stripeColors.done : stripeColors.attention} testID={`ticket-${t.code}`} title={`${t.code} · ${t.subject}`} subtitle={t.type} meta={fmtDateTime(t.created_at)} right={<StatusBadge status={t.status} />} chevron onPress={() => setOpen(t)} />
            ))}
          </View>
        ) : <EmptyState icon="life-buoy" title={scope === 'open' ? 'No open tickets' : 'No previous tickets'} />}
      </QueryState>
      <RaiseTicket visible={raising} types={list.data?.types ?? []} onClose={() => setRaising(false)} onDone={() => { setRaising(false); setDone(true); void refresh() }} />
      <TicketDetail ticket={open} onClose={() => setOpen(null)} onChanged={refresh} />
      <MascotDialog testID="ticket-done" visible={done} image={mascot} message="You have successfully submitted a query. Our support team will get in touch shortly."
        actions={[{ label: 'Exit', testID: 'ticket-done-ok', onPress: () => setDone(false) }]} />
    </Screen>
  )
}

function RaiseTicket({ visible, types, onClose, onDone }: { visible: boolean; types: string[]; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const raise = useMutation({ mutationFn: () => api.post('/api/engage/tickets', { type, subject: subject.trim(), description: description.trim() }) })
  return (
    <Sheet testID="ticket-sheet" visible={visible} onClose={onClose} title="Raise a Ticket"
      footer={<Button testID="ticket-submit" label="Submit" size="lg" full loading={raise.isPending} onPress={() => {
        if (!type || subject.trim().length < 3 || description.trim().length < 5) return setError('Choose the type, give a subject and describe the problem.')
        raise.mutate(undefined, { onSuccess: () => { setType(''); setSubject(''); setDescription(''); setError(null); onDone() }, onError: (e) => setError(errorMessage(e)) })
      }} />}>
      <T variant="smallStrong">Complaint Type</T>
      <Row wrap gap={space.xs}>{types.filter((t) => t !== 'Store enquiry' && t !== 'Subscription').map((t) => <Chip key={t} testID={`ticket-type-${t}`} label={t} selected={type === t} onPress={() => setType(t)} />)}</Row>
      <TextField testID="ticket-subject" label="Subject" value={subject} onChangeText={setSubject} maxLength={120} />
      <TextField testID="ticket-description" label="Description" value={description} onChangeText={setDescription} multiline maxLength={2000} />
      {!!error && <Banner testID="ticket-error" tone="red" icon="alert-circle" text={error} />}
    </Sheet>
  )
}

function TicketDetail({ ticket, onClose, onChanged }: { ticket: Ticket | null; onClose: () => void; onChanged: () => void }) {
  const [text, setText] = useState('')
  const detail = useQuery<Ticket>({ queryKey: ['engage', 'ticket', ticket?.id], queryFn: () => api.get(`/api/engage/tickets/${ticket!.id}`), enabled: !!ticket })
  const reply = useMutation({ mutationFn: () => api.post(`/api/engage/tickets/${ticket!.id}/reply`, { text: text.trim() }) })
  const t = detail.data ?? ticket
  return (
    <Sheet testID="ticket-detail" visible={!!ticket} onClose={onClose} title={t ? `Ticket id: ${t.code}` : ''} subtitle={t?.subject}>
      {t && (
        <>
          <T>{t.description}</T>
          <Section title="Status">
            {t.timeline.map((s, i) => <T key={i} variant="small" color={s.by === 'Dentor support' ? colors.title : colors.text}>{`${s.status} · ${fmtDateTime(s.at)} · ${s.by}${s.text ? `: ${s.text}` : ''}`}</T>)}
          </Section>
          {t.status !== 'Resolved' && (
            <>
              <TextField testID="ticket-reply" label="Add a message" value={text} onChangeText={setText} multiline maxLength={2000} />
              <Button testID="ticket-reply-send" label="Send" variant="secondary" full loading={reply.isPending} onPress={() => text.trim() && reply.mutate(undefined, { onSuccess: () => { setText(''); void detail.refetch(); onChanged() } })} />
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
