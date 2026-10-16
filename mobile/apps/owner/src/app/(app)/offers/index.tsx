import { api, Button, EmptyState, QueryState, Screen, Sheet, T, colors, face, fmtDateTime, radius, shadow, space } from '@dentor/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRefresh } from '@/hooks/useRefresh'
import { useRouter } from '@/nav'

interface Offer { id: string; title: string; treatment: string; label: string; valid_till: string; status: string; viewed: number; booked: number; send_at?: string; recipients?: number }

/** "my Post" (dentor.fig 249–250): the clinic's offers with how many patients viewed and booked. */
export default function Offers() {
  const router = useRouter()
  const list = useQuery<{ items: Offer[] }>({ queryKey: ['clinic-app', 'offers'], queryFn: () => api.get('/api/engage/offers') })
  const { refreshing, refresh } = useRefresh(list)
  const [open, setOpen] = useState<Offer | null>(null)
  const detail = useQuery<Offer & { viewers: { patient: string; code: string; at: string }[]; bookers: { patient: string; code: string; at: string }[] }>({
    queryKey: ['clinic-app', 'offer', open?.id], queryFn: () => api.get(`/api/engage/offers/${open!.id}`), enabled: !!open,
  })
  return (
    <Screen pattern testID="offers-screen" title="My Posts" back refreshing={refreshing} onRefresh={refresh}
      footer={<Button testID="offer-new" label="Post an Offer" icon="plus" size="lg" full onPress={() => router.push('/offers/new')} />}>
      <QueryState query={list}>
        {(data) => data.items.length ? (
          <View style={{ gap: space.md }}>
            {data.items.map((o) => <OfferCard key={o.id} offer={o} onOpen={() => setOpen(o)}
              onEdit={() => router.push({ pathname: '/offers/new', params: { id: o.id } })} />)}
          </View>
        ) : <EmptyState icon="tag" title="No offers posted" message="Post an offer and patients with the app are told about it." />}
      </QueryState>
      <Sheet testID="offer-detail" visible={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''} subtitle={open ? `${open.label} · ${open.recipients ?? 0} patients told` : ''}
        footer={open ? <Button label="Edit" variant="secondary" full onPress={() => { setOpen(null); router.push({ pathname: '/offers/new', params: { id: open.id } }) }} /> : undefined}>
        <T variant="smallStrong">Viewed ({detail.data?.viewed ?? 0})</T>
        {detail.data?.viewers.map((v, i) => <T key={i} variant="small" color={colors.textMuted}>{`${v.patient} · ${v.code} · ${fmtDateTime(v.at)}`}</T>)}
        <T variant="smallStrong">Booked ({detail.data?.booked ?? 0})</T>
        {detail.data?.bookers.map((v, i) => <T key={i} variant="small" color={colors.textMuted}>{`${v.patient} · ${v.code} · ${fmtDateTime(v.at)}`}</T>)}
      </Sheet>
    </Screen>
  )
}

/** "10% OFF" on the left, the offer's terms on the right, as dentor.fig "post a offer view my post" (249) draws it. */
function OfferCard({ offer: o, onOpen, onEdit }: { offer: Offer; onOpen: () => void; onEdit: () => void }) {
  const [amount] = o.label.split(' off')
  const big = amount.endsWith(' ₹') ? `₹${amount.slice(0, -2)}` : amount
  const terms = [
    o.treatment ? `TREATMENT : ${o.treatment.toUpperCase()}` : 'GENERAL OFFER',
    `DISCOUNT: ${big}`,
    `VALID TILL: ${o.valid_till.slice(0, 10)}`,
  ]
  // the card opens the offer, EDIT is its own button beside it (a button inside a button is not allowed)
  return (
    <View testID={`offer-${o.title}`} style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${o.title}, ${o.label}`} onPress={onOpen}
        style={({ pressed }) => [styles.open, pressed && { opacity: 0.9 }]}>
        <View style={styles.badge}>
          <Text style={styles.badgeValue} numberOfLines={1} adjustsFontSizeToFit>{big}</Text>
          <Text style={styles.badgeOff}>OFF</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>{o.title}</Text>
          {terms.map((t) => <Text key={t} style={styles.term} numberOfLines={1}>{t}</Text>)}
          <Text style={styles.meta} numberOfLines={1}>{o.status === 'Scheduled' ? `Goes out ${fmtDateTime(o.send_at ?? '')}` : `${o.viewed} viewed · ${o.booked} booked`}</Text>
        </View>
      </Pressable>
      <Pressable testID={`offer-edit-${o.title}`} accessibilityRole="button" accessibilityLabel={`Edit ${o.title}`} hitSlop={8} onPress={onEdit} style={styles.edit}>
        <Text style={styles.editText}>EDIT</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow },
  open: { flexDirection: 'row' },
  badge: { width: 104, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs, paddingVertical: space.md },
  badgeValue: { ...face('bold'), fontSize: 34, lineHeight: 40, color: '#ffffff' },
  badgeOff: { ...face('bold'), fontSize: 30, lineHeight: 34, color: '#ffffff' },
  body: { flex: 1, minWidth: 0, padding: space.md, paddingBottom: space.md + 36, gap: 2 },
  title: { ...face('semibold'), fontSize: 13, color: colors.textMuted },
  term: { ...face('semibold'), fontSize: 15, lineHeight: 20, color: colors.textStrong },
  meta: { ...face('regular'), fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  edit: { position: 'absolute', right: space.md, bottom: space.md, minHeight: 32, minWidth: 64, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' },
  editText: { ...face('bold'), fontSize: 14, color: '#ffffff' },
})
