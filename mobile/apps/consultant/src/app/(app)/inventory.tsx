import { api, Banner, Button, Chip, EmptyState, errorMessage, ListRow, QueryState, Row, Screen, Segmented, Sheet, StatTile, T, TextField, TileGrid, colors, fmtDateTime, space, useToast } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { View } from 'react-native'
import { useRouter } from '@/nav'

interface Item { id: string; name: string; category: string; stock: number; unit: string; reorder: number; low: boolean }
interface Inventory { items: Item[]; totals: { items: number; low: number; cases_today: number }; history: { item: string; change: number; reason: string; case: string; at: string }[] }

/** The consultant's own kit (dentor.fig 401–405): items, low stock, adjust, history and usage per case. */
export default function InventoryScreen() {
  const router = useRouter()
  const toast = useToast()
  const queryClient = useQueryClient()
  const inv = useQuery<Inventory>({ queryKey: ['inventory'], queryFn: () => api.get('/api/engage/inventory') })
  const [tab, setTab] = useState<'items' | 'history' | 'usage'>('items')
  const [adding, setAdding] = useState(false)
  const [adjusting, setAdjusting] = useState<Item | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['inventory'] })
  return (
    <Screen testID="inventory-screen" title="Inventory" back footer={<Button testID="inventory-add" label="Add item" icon="plus" size="lg" full onPress={() => setAdding(true)} />}>
      <QueryState query={inv}>
        {(data) => (
          <>
            <TileGrid>
              <StatTile testID="inventory-total" label="Total Items" value={data.totals.items} icon="package" />
              <StatTile testID="inventory-low" label="Low Stock" value={data.totals.low} icon="alert-triangle" tone="red" />
              <StatTile label="Cases Today" value={data.totals.cases_today} icon="calendar" tone="blue" />
            </TileGrid>
            <Button label="Buy Supplies" icon="shopping-bag" variant="secondary" full onPress={() => router.push('/store')} />
            <Segmented options={[{ key: 'items', label: 'Items' }, { key: 'history', label: 'History' }, { key: 'usage', label: 'Usage' }]} value={tab} onChange={setTab} />
            {tab === 'items' ? (data.items.length ? (
              <View style={{ gap: space.xs }}>
                {data.items.map((i) => (
                  <ListRow key={i.id} testID={`stock-${i.name}`} title={i.name} subtitle={`${i.stock} ${i.unit} · reorder at ${i.reorder}${i.category ? ` · ${i.category}` : ''}`}
                    right={<T variant="smallStrong" color={i.low ? colors.red : colors.title}>{i.low ? 'Low' : 'Adjust'}</T>} onPress={() => setAdjusting(i)} />
                ))}
              </View>
            ) : <EmptyState icon="package" title="No items yet" message="Add the kit you carry to clinics." />) : (
              <View style={{ gap: space.xs }}>
                {data.history.filter((h) => (tab === 'usage' ? h.change < 0 : true)).map((h, i) => (
                  <ListRow key={i} title={`${h.item} ${h.change > 0 ? `+${h.change}` : h.change}`} subtitle={[h.reason, h.case && `Case ${h.case}`].filter(Boolean).join(' · ')} meta={fmtDateTime(h.at)} />
                ))}
                {!data.history.length && <T variant="small" color={colors.textMuted}>Nothing yet.</T>}
              </View>
            )}
          </>
        )}
      </QueryState>
      <AddItem visible={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); void refresh(); toast.success('Item added.') }} />
      <Adjust item={adjusting} onClose={() => setAdjusting(null)} onDone={() => { setAdjusting(null); void refresh(); toast.success('Product has been updated successfully.') }} />
    </Screen>
  )
}

function AddItem({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', category: '', stock: '', unit: 'pcs', reorder: '' })
  const [error, setError] = useState<string | null>(null)
  const add = useMutation({ mutationFn: () => api.post('/api/engage/inventory', { ...f, stock: Number(f.stock) || 0, reorder: Number(f.reorder) || 0 }) })
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }))
  return (
    <Sheet testID="inventory-sheet" visible={visible} onClose={onClose} title="Add item"
      footer={<Button testID="inventory-save" label="SAVE" size="lg" full loading={add.isPending} onPress={() => add.mutate(undefined, { onSuccess: () => { setF({ name: '', category: '', stock: '', unit: 'pcs', reorder: '' }); setError(null); onDone() }, onError: (e) => setError(errorMessage(e)) })} />}>
      <TextField testID="inventory-name" label="Item" value={f.name} onChangeText={set('name')} maxLength={80} />
      <TextField label="Category" value={f.category} onChangeText={set('category')} maxLength={40} />
      <Row gap={space.sm}>
        <View style={{ flex: 1 }}><TextField testID="inventory-stock" label="In stock" value={f.stock} onChangeText={set('stock')} keyboardType="number-pad" maxLength={6} /></View>
        <View style={{ flex: 1 }}><TextField label="Reorder at" value={f.reorder} onChangeText={set('reorder')} keyboardType="number-pad" maxLength={6} /></View>
      </Row>
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
    </Sheet>
  )
}

function Adjust({ item, onClose, onDone }: { item: Item | null; onClose: () => void; onDone: () => void }) {
  const [change, setChange] = useState(-1)
  const [caseRef, setCaseRef] = useState('')
  const [error, setError] = useState<string | null>(null)
  const adjust = useMutation({ mutationFn: () => api.post(`/api/engage/inventory/${item!.id}/adjust`, { change, case: caseRef.trim(), reason: change < 0 ? 'Used' : 'Restocked' }) })
  return (
    <Sheet testID="adjust-sheet" visible={!!item} onClose={onClose} title={item?.name ?? ''} subtitle={item ? `${item.stock} ${item.unit} in stock` : ''}
      footer={<Button testID="adjust-save" label="SAVE" size="lg" full loading={adjust.isPending} onPress={() => adjust.mutate(undefined, { onSuccess: () => { setCaseRef(''); setError(null); onDone() }, onError: (e) => setError(errorMessage(e)) })} />}>
      <Row wrap gap={space.xs}>{[-5, -2, -1, 1, 5, 10].map((n) => <Chip key={n} testID={`adjust-${n}`} label={n > 0 ? `+${n}` : String(n)} selected={change === n} onPress={() => setChange(n)} />)}</Row>
      {change < 0 && <TextField testID="adjust-case" label="Case (optional)" value={caseRef} onChangeText={setCaseRef} placeholder="e.g. CNS-2003" maxLength={40} />}
      {!!error && <Banner tone="red" icon="alert-circle" text={error} />}
    </Sheet>
  )
}
