import { colors, fmtINR, space, StatusBadge, T, face } from '@dentor/shared'
import { View } from 'react-native'
import { dotJoin } from '@/lib/people'
import type { EarningsInvoice } from '@/types'

export function InvoiceRow({ invoice: inv }: { invoice: EarningsInvoice }) {
  return (
    <View testID={`invoice-${inv.id}`} style={{ padding: space.lg, gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <T variant="bodyStrong" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{inv.patient || 'Patient'}</T>
        <T variant="bodyStrong">{fmtINR(inv.total)}</T>
      </View>
      <T variant="small" color={colors.textMuted} numberOfLines={1}>{dotJoin(inv.treatment, inv.date_label)}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <StatusBadge status={inv.status} />
        <T variant="tiny" color={colors.textFaint} style={{ ...face('medium'), flex: 1, minWidth: 0 }} numberOfLines={1}>
          {dotJoin(inv.number, Number(inv.balance) > 0 && `${fmtINR(inv.balance)} due`)}
        </T>
      </View>
    </View>
  )
}
