import { api, colors, face, fmtINR, radius, shadow, space } from '@dentor/shared'
import { useQuery } from '@tanstack/react-query'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

interface Product { id: string; name: string; brand: string; price: number; mrp: number }

/**
 * The design's product strip (dentor.fig "Home" 37:626: 90 × 107 supply cards), filled from the Dentor
 * store's real catalogue. With no products in the catalogue the strip is left out: the design's sample
 * cards and prices are not shown as if they were real.
 */
export function Products({ onOpen }: { onOpen?: () => void }) {
  const list = useQuery<{ items: Product[] }>({ queryKey: ['engage', 'products', 'home'], queryFn: () => api.get('/api/engage/products') })
  const items = (list.data?.items ?? []).slice(0, 8)
  if (!items.length) return null
  return (
    <ScrollView testID="products" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((p) => (
        <Pressable key={p.id} testID={`home-product-${p.id}`} accessibilityRole="button" accessibilityLabel={`${p.name}, ${fmtINR(p.price)}`} disabled={!onOpen} onPress={onOpen} style={styles.card}>
          <Text numberOfLines={3} style={styles.name}>{p.name}</Text>
          <View>
            {p.mrp > p.price && <Text style={styles.mrp}>{fmtINR(p.mrp)}</Text>}
            <Text style={styles.price}>{fmtINR(p.price)}</Text>
            {!!p.brand && <Text numberOfLines={1} style={styles.brand}>{p.brand}</Text>}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: space.xs, paddingVertical: 2 },
  card: { width: 104, minHeight: 112, borderRadius: radius.md, backgroundColor: colors.brand50, padding: space.sm, justifyContent: 'space-between', ...shadow },
  name: { ...face('semibold'), fontSize: 11, lineHeight: 14, color: colors.textStrong },
  mrp: { ...face('regular'), fontSize: 10, color: colors.textMuted, textDecorationLine: 'line-through' },
  price: { ...face('bold'), fontSize: 14, color: colors.header },
  brand: { ...face('regular'), fontSize: 9, color: colors.textMuted },
})
