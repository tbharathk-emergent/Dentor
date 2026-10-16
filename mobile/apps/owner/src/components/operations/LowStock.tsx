import { Badge, Card, Divider, ListRow, Section, T, colors, space, statusTone } from '@dentor/shared'
import { View } from 'react-native'
import { plural } from '@/lib/format'
import type { LowStockItem } from '@/types'

/** The stock statuses as the reception app's Pharmacy and Inventory pages name them. */
const OUT_OF_STOCK = 'Out of Stock'
const LOW_STOCK = 'Low Stock'

function StockGroup({ title, items, emptyText, testID }: { title: string; items: LowStockItem[]; emptyText: string; testID: string }) {
  const out = items.filter((item) => item.out).length
  return (
    <View testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md }}>
        <T variant="smallStrong" color={colors.textMuted}>
          {title}
        </T>
        {out > 0 && (
          <T variant="tiny" color={colors.red} testID={`${testID}-out-count`}>
            {`${out} out of stock`}
          </T>
        )}
      </View>
      {items.length === 0 ? (
        <View style={{ padding: space.lg, paddingTop: space.sm }}>
          <T variant="small" color={colors.textMuted} testID={`${testID}-empty`}>
            {emptyText}
          </T>
        </View>
      ) : (
        items.map((item, index) => (
          <View key={item.id}>
            {index > 0 && <Divider inset={space.lg} />}
            <ListRow
              testID="stock-item"
              title={item.name || item.code}
              subtitle={item.out ? `None left · reorder level ${item.reorder}` : `${plural(item.stock, 'unit')} left · reorder level ${item.reorder}`}
              meta={item.code}
              right={item.out ? <Badge testID="stock-out" label={OUT_OF_STOCK} tone={statusTone(OUT_OF_STOCK)} /> : <Badge testID="stock-low" label={LOW_STOCK} tone={statusTone(LOW_STOCK)} />}
            />
          </View>
        ))
      )}
    </View>
  )
}

/** Medicines and supplies at or below their reorder level; empty shelves are called out in red. */
export function LowStock({ pharmacy, inventory }: { pharmacy: LowStockItem[]; inventory: LowStockItem[] }) {
  return (
    <Section title="Low stock">
      <Card padded={false} testID="low-stock-card">
        <StockGroup testID="pharmacy-low" title="Pharmacy" items={pharmacy} emptyText="Every medicine is above its reorder level." />
        <Divider />
        <StockGroup testID="inventory-low" title="Inventory" items={inventory} emptyText="Every supply is above its reorder level." />
      </Card>
    </Section>
  )
}
