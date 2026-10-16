import { Card, ProgressBar, StatTile, T, TileGrid, colors, space } from '@dentor/shared'
import { View } from 'react-native'
import { fmtMoney } from '@/lib/format'

/** Billed against collected for the period, with collections as a share of billing. */
export function CollectionSummary({ billed, collected }: { billed: number; collected: number }) {
  const share = billed > 0 ? Math.round((collected / billed) * 100) : null
  return (
    <View style={{ gap: space.md }}>
      <TileGrid>
        <StatTile testID="fin-billed" icon="file-text" tone="brand" label="Billed" value={fmtMoney(billed)} hint="Invoices raised" />
        <StatTile testID="fin-collected" icon="check-circle" tone="green" label="Collected" value={fmtMoney(collected)} hint="Payments received" />
      </TileGrid>
      {share !== null && (
        <Card style={{ gap: space.sm }}>
          <T variant="small" color={colors.textMuted}>
            Payments received in this period come to{' '}
            <T variant="smallStrong" testID="fin-collection-share">
              {share}%
            </T>{' '}
            of what was billed in it.
          </T>
          <ProgressBar value={collected} max={billed} tone="green" />
        </Card>
      )}
    </View>
  )
}
