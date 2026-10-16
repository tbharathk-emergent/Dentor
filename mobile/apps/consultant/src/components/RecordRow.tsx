import { colors, fmtDate, fmtINR, space, StatusBadge, T } from '@dentor/shared'
import { View } from 'react-native'
import { dotJoin } from '@/lib/people'
import type { ClinicalRecord } from '@/types'

/** A treatment-plan entry or a procedure. */
export function RecordRow({ record: r, testID }: { record: ClinicalRecord; testID?: string }) {
  return (
    <View testID={testID} style={{ padding: space.lg, gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <T variant="bodyStrong" style={{ flex: 1, minWidth: 0 }}>{r.name}</T>
        <StatusBadge status={r.status} />
      </View>
      <T variant="small" color={colors.textMuted}>
        {dotJoin(r.tooth && (/^\d/.test(r.tooth) ? `Tooth ${r.tooth}` : r.tooth), r.date && fmtDate(r.date), r.doctor)}
      </T>
      {!!r.cost && <T variant="smallStrong">{fmtINR(r.cost)}</T>}
      {!!r.notes && <T variant="small" color={colors.textMuted}>{r.notes}</T>}
    </View>
  )
}
