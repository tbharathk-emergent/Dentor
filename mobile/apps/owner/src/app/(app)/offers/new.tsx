import { api, addDays, Banner, Button, Chip, errorMessage, MascotDialog, Row, Screen, Section, T, TextField, colors, space, todayISO, useLocalSearchParams } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import mascot from '@/assets/design/mascot-happy.png'
import { useTariff } from '@/clinic/clinical'
import { useRouter } from '@/nav'

const HOURS = ['09:00', '11:00', '13:00', '16:00', '18:00']

/**
 * "Create a Offer" (dentor.fig 243–248): title, treatment-specific or general, category, percentage or amount, value,
 * valid till, then send now or at a chosen time; "successfully Posted" (248). Patients with the app are told.
 */
export default function NewOffer() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const tariff = useTariff()
  const existing = useQuery<Record<string, any>>({ queryKey: ['clinic-app', 'offer', id], queryFn: () => api.get(`/api/engage/offers/${id}`), enabled: !!id })
  const dates = useMemo(() => Array.from({ length: 10 }, (_, i) => addDays(todayISO(), i)), [])
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'treatment' | 'general'>('treatment')
  const [treatment, setTreatment] = useState('')
  const [category, setCategory] = useState('')
  const [type, setType] = useState<'percentage' | 'amount'>('percentage')
  const [value, setValue] = useState('')
  const [till, setTill] = useState(addDays(todayISO(), 30))
  const [send, setSend] = useState<'now' | 'later'>('now')
  const [day, setDay] = useState(dates[1])
  const [hour, setHour] = useState(HOURS[0])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  useEffect(() => {
    const o = existing.data
    if (!o) return
    setTitle(o.title); setKind(o.kind); setTreatment(o.treatment ?? ''); setCategory(o.category ?? ''); setType(o.discount_type); setValue(String(o.value)); setTill(o.valid_till)
  }, [existing.data])
  const save = useMutation({
    mutationFn: (body: object) => (id ? api.patch(`/api/engage/offers/${id}`, body) : api.post('/api/engage/offers', body)),
  })
  const submit = () => {
    const v = Number(value)
    if (title.trim().length < 3) return setError('Give the offer a title.')
    if (kind === 'treatment' && !treatment) return setError('Choose the treatment.')
    if (!(v > 0) || (type === 'percentage' && v > 90)) return setError('A discount is more than 0 and at most 90%.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(till)) return setError('Valid till is like 2026-11-30.')
    setError(null)
    save.mutate({ title: title.trim(), kind, treatment: kind === 'treatment' ? treatment : '', category, discount_type: type, value: v, valid_till: till,
      send, send_at: send === 'later' ? `${day}T${hour}` : '' }, {
      onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['clinic-app', 'offers'] }); setDone(true) },
      onError: (e) => setError(errorMessage(e)),
    })
  }
  const treatments = (tariff.data?.groups ?? []).flatMap((g) => g.items.map((t) => ({ name: t.name, category: g.category })))
  return (
    <Screen pattern testID="offer-new-screen" title={id ? 'Edit Offer' : 'Create a Offer'} back footer={<Button testID="offer-post" label={id ? 'Save' : 'Post'} size="lg" full loading={save.isPending} onPress={submit} />}>
      <TextField testID="offer-title" label="Offer Title" value={title} onChangeText={setTitle} placeholder="20% Off on Cleaning" maxLength={80} />
      <Row gap={space.sm}>
        <Chip testID="offer-kind-treatment" label="Treatment Specific" selected={kind === 'treatment'} onPress={() => setKind('treatment')} />
        <Chip testID="offer-kind-general" label="General Offer" selected={kind === 'general'} onPress={() => setKind('general')} />
      </Row>
      {kind === 'treatment' && (
        <Section title="Select Treatment">
          <Row wrap gap={space.xs}>
            {treatments.slice(0, 24).map((t) => <Chip key={t.name} testID={`offer-treatment-${t.name}`} label={t.name} selected={treatment === t.name} onPress={() => { setTreatment(t.name); setCategory(t.category) }} />)}
          </Row>
        </Section>
      )}
      <Section title="Discount Type">
        <Row gap={space.sm}>
          <Chip testID="offer-type-percentage" label="Percentage" selected={type === 'percentage'} onPress={() => setType('percentage')} />
          <Chip testID="offer-type-amount" label="Amount" selected={type === 'amount'} onPress={() => setType('amount')} />
        </Row>
        <TextField testID="offer-value" label={type === 'percentage' ? 'Discount Value (%)' : 'Discount Value (₹)'} value={value} onChangeText={setValue} keyboardType="decimal-pad" maxLength={6} />
      </Section>
      <TextField testID="offer-till" label="Valid till" value={till} onChangeText={setTill} placeholder="yyyy-mm-dd" maxLength={10} />
      {!id && (
        <Section title="Sending option">
          <Row gap={space.sm}>
            <Chip testID="offer-send-now" label="Send now" selected={send === 'now'} onPress={() => setSend('now')} />
            <Chip testID="offer-send-later" label="Send later" selected={send === 'later'} onPress={() => setSend('later')} />
          </Row>
          {send === 'later' && (
            <>
              <Row wrap gap={space.xs}>{dates.slice(1).map((d) => <Chip key={d} label={d.slice(5).split('-').reverse().join('/')} selected={day === d} onPress={() => setDay(d)} />)}</Row>
              <Row wrap gap={space.xs}>{HOURS.map((h) => <Chip key={h} label={h} selected={hour === h} onPress={() => setHour(h)} />)}</Row>
            </>
          )}
        </Section>
      )}
      <T variant="tiny" color={colors.textMuted}>Patients who use the Dentor patient app see the offer and a notification. Text messages and WhatsApp are not sent.</T>
      {!!error && <Banner testID="offer-error" tone="red" icon="alert-circle" text={error} />}
      <MascotDialog testID="offer-done" visible={done} image={mascot} message={id ? 'The offer is updated.' : send === 'later' ? 'The offer is scheduled.' : 'You have successfully posted an offer.'}
        actions={[{ label: 'OK', testID: 'offer-done-ok', onPress: () => { setDone(false); router.replace('/offers') } }]} />
    </Screen>
  )
}
