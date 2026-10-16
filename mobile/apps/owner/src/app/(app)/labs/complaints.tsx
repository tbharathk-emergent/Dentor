import { Banner, Button, Chip, EmptyState, ListRow, MascotDialog, QueryState, Row, Screen, Segmented, Sheet, StatusBadge, T, TextField, colors, errorMessage, fmtDateTime, space, useToast, stripeColors } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { useComplaintStatus, useComplaints, useLabOrders, useLabs, useRaiseComplaint, type LabComplaint } from '@/clinic/clinical'
import mascot from '@/assets/design/mascot-happy.png'
import { useRefresh } from '@/hooks/useRefresh'

type Tab = 'New' | 'In progress' | 'Resolved'

/** "COMPLAINTS" (dentor.fig 179–187): new, on going and completed; create one; mark it resolved. */
export default function Complaints() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('New')
  const list = useComplaints(tab)
  const { refreshing, refresh } = useRefresh(list)
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<LabComplaint | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const status = useComplaintStatus()
  const counts = list.data?.counts

  const move = (c: LabComplaint, next: 'In progress' | 'Resolved') =>
    status.mutate({ id: c.id, status: next }, {
      onSuccess: () => { setOpen(null); next === 'Resolved' ? setDone('This complaint has been successfully marked as resolved.') : toast.success('Marked as in progress.') },
      onError: (e) => toast.error(e),
    })

  return (
    <Screen pattern testID="complaints-screen" title="Complaints" back refreshing={refreshing} onRefresh={refresh}
      footer={<Button testID="complaint-new" label="Raise a complaint" icon="plus" size="lg" full onPress={() => setCreating(true)} />}>
      <Segmented options={[
        { key: 'New', label: `New${counts ? ` (${counts.New})` : ''}` },
        { key: 'In progress', label: `On going${counts ? ` (${counts['In progress']})` : ''}` },
        { key: 'Resolved', label: 'Completed' },
      ]} value={tab} onChange={setTab} />
      <QueryState query={list}>
        {(data) => data.items.length ? (
          <View style={{ gap: space.md }}>
            {data.items.map((c) => (
              <ListRow key={c.id} stripe={c.status === 'Resolved' ? stripeColors.done : c.status === 'New' ? stripeColors.attention : stripeColors.progress} testID={`complaint-${c.code}`} title={`${c.patient} · ${c.type}`} subtitle={`Case ${c.order_code} · ${c.lab}`} meta={fmtDateTime(c.created_at)}
                right={<StatusBadge status={c.status} />} chevron onPress={() => setOpen(c)} />
            ))}
          </View>
        ) : <EmptyState icon="check-circle" title="Nothing here" />}
      </QueryState>
      <Sheet testID="complaint-detail" visible={!!open} onClose={() => setOpen(null)} title="DETAILS" subtitle={open ? `${open.patient} · Case ${open.order_code} · ${open.treatment}` : ''}
        footer={open && open.status !== 'Resolved' ? (
          <View style={{ gap: space.sm }}>
            {open.status === 'New' && <Button testID="complaint-progress" label="Lab is working on it" variant="secondary" full onPress={() => move(open, 'In progress')} />}
            <Button testID="complaint-resolve" label="Mark as resolved" full loading={status.isPending} onPress={() => move(open, 'Resolved')} />
          </View>
        ) : undefined}>
        {open && (
          <>
            <T variant="smallStrong">Complaint</T>
            <T>{open.type}: {open.description}</T>
            {open.timeline.map((t, i) => <T key={i} variant="tiny" color={colors.textMuted}>{`${t.status} · ${fmtDateTime(t.at)} · ${t.by}`}</T>)}
          </>
        )}
      </Sheet>
      <CreateComplaint visible={creating} onClose={() => setCreating(false)} onDone={() => { setCreating(false); setDone('Your complaint has been submitted successfully. You will be notified once it is reviewed by the lab.') }} />
      <MascotDialog testID="complaint-done" visible={!!done} image={mascot} message={done ?? ''} actions={[{ label: 'OK', testID: 'complaint-done-ok', onPress: () => setDone(null) }]} />
    </Screen>
  )
}

function CreateComplaint({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const orders = useLabOrders('ongoing')
  const delivered = useLabOrders('completed')
  const types = useLabs().data?.options.complaint_types ?? []
  const raise = useRaiseComplaint()
  const [orderId, setOrderId] = useState('')
  const [type, setType] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const all = [...(orders.data?.items ?? []), ...(delivered.data?.items ?? [])]
  return (
    <Sheet testID="complaint-create" visible={visible} onClose={onClose} title="Create complaint"
      footer={<Button testID="complaint-submit" label="Submit" size="lg" full loading={raise.isPending} onPress={() => {
        if (!orderId || !type || text.trim().length < 5) return setError('Choose the case and the type, and describe the problem.')
        raise.mutate({ order_id: orderId, type, description: text.trim() }, { onSuccess: () => { setOrderId(''); setType(''); setText(''); setError(null); onDone() }, onError: (e) => setError(errorMessage(e)) })
      }} />}>
      <T variant="smallStrong">Case</T>
      <View style={{ gap: 4 }}>
        {all.slice(0, 12).map((o) => (
          <Chip key={o.id} testID={`complaint-order-${o.code}`} label={`${o.code} · ${o.patient} · ${o.caseType}`} selected={orderId === o.id} onPress={() => setOrderId(o.id)} />
        ))}
      </View>
      <T variant="smallStrong">Complaint Type</T>
      <Row wrap gap={space.sm}>{types.map((t) => <Chip key={t} testID={`complaint-type-${t}`} label={t} selected={type === t} onPress={() => setType(t)} />)}</Row>
      <TextField testID="complaint-description" label="Description" value={text} onChangeText={setText} multiline maxLength={1000} />
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
    </Sheet>
  )
}
