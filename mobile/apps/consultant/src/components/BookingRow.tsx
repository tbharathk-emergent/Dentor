import { colors, fmtINR, space, StatusBadge, T, face } from '@dentor/shared'
import { View } from 'react-native'
import { dotJoin } from '@/lib/people'
import type { Booking } from '@/types'

/** A referral booking made for this consultant at the front desk. */
export function BookingRow({ booking: b }: { booking: Booking }) {
  return (
    <View testID={`booking-${b.id}`} style={{ padding: space.lg, gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <T variant="bodyStrong" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{b.patient || 'Patient'}</T>
        <StatusBadge status={b.status} />
      </View>
      <T variant="small" color={colors.textMuted}>{dotJoin(b.date_label, b.time_label, b.reason)}</T>
      {!!b.notes && <T variant="small" color={colors.textMuted}>{b.notes}</T>}
      <T variant="tiny" color={colors.textFaint} style={{ ...face('medium') }}>{dotJoin(b.code, b.patientCode, b.fee ? fmtINR(b.fee) : null)}</T>
    </View>
  )
}
