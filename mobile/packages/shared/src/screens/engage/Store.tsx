import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { View } from 'react-native'
import { api, errorMessage } from '../../api'
import { fmtINR } from '../../format'
import { space } from '../../theme'
import { Sheet, useToast } from '../../ui/feedback'
import { ListRow, Screen } from '../../ui/layout'
import { Banner, Button, Chip, Row, T, TextField } from '../../ui/primitives'
import { EmptyState, QueryState } from '../../ui/states'

interface Product { id: string; name: string; category: string; price: number; mrp: number; brand: string; description: string }

/** The Dentor store (dentor.fig "E-com", home's products): the catalogue with enquiry. Checkout is excluded. */
export function StoreScreen() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [picked, setPicked] = useState<Product | null>(null)
  const [qty, setQty] = useState('1')
  const [note, setNote] = useState('')
  const list = useQuery<{ items: Product[]; categories: string[] }>({
    queryKey: ['engage', 'products', q, category],
    queryFn: () => api.get(`/api/engage/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`),
  })
  const enquire = useMutation({ mutationFn: () => api.post(`/api/engage/products/${picked!.id}/enquire`, { quantity: Number(qty) || 1, note: note.trim() }) })
  return (
    <Screen testID="store-screen" title="Dentor Store" back>
      <TextField testID="store-search" icon="search" value={q} onChangeText={setQ} placeholder="Search supplies" autoCapitalize="none" />
      <QueryState query={list}>
        {(data) => (
          <>
            <Row wrap gap={space.xs}>
              <Chip label="All" selected={!category} onPress={() => setCategory('')} />
              {data.categories.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
            </Row>
            {data.items.length ? (
              <View style={{ gap: space.xs }}>
                {data.items.map((p) => (
                  <ListRow key={p.id} testID={`product-${p.name}`} title={p.name} subtitle={`${p.brand} · ${p.category}`} meta={p.description}
                    right={<T variant="bodyStrong">{fmtINR(p.price)}</T>} onPress={() => setPicked(p)} />
                ))}
              </View>
            ) : <EmptyState icon="shopping-bag" title="Nothing matches" />}
          </>
        )}
      </QueryState>
      <Sheet testID="enquiry-sheet" visible={!!picked} onClose={() => setPicked(null)} title={picked?.name ?? ''} subtitle={picked ? `${fmtINR(picked.price)} (MRP ${fmtINR(picked.mrp)})` : ''}
        footer={<Button testID="enquiry-send" label="Send enquiry" size="lg" full loading={enquire.isPending} onPress={() => enquire.mutate(undefined, {
          onSuccess: () => { setPicked(null); setQty('1'); setNote(''); toast.success('Enquiry sent. Dentor will send you a quote.') },
          onError: (e) => toast.error(new Error(errorMessage(e))),
        })} />}>
        <T>{picked?.description}</T>
        <TextField testID="enquiry-qty" label="Quantity" value={qty} onChangeText={setQty} keyboardType="number-pad" maxLength={3} />
        <TextField label="Note" value={note} onChangeText={setNote} maxLength={300} />
        <Banner tone="blue" icon="info" text="Buying in the app is not available yet. Dentor answers your enquiry with a quote." />
      </Sheet>
    </Screen>
  )
}
