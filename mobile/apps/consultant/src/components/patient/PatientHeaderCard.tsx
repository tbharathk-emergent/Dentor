import { Avatar, Badge, Card, colors, riskTone, space, StatusBadge, T } from '@dentor/shared'
import { View } from 'react-native'
import { ageGender, dotJoin } from '@/lib/people'
import type { PatientSummary } from '@/types'

export function PatientHeaderCard({ patient: p }: { patient: PatientSummary }) {
  return (
    <Card testID="patient-header" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Avatar name={p.name} uri={p.photo || undefined} size={56} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T variant="h2" numberOfLines={2} testID="patient-name">{p.name}</T>
        <T variant="small" color={colors.textMuted} testID="patient-code">{dotJoin(p.code, ageGender(p), p.blood)}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs }}>
          <StatusBadge status={p.status} />
          {!!p.risk && <Badge label={`${p.risk} Risk`} tone={riskTone(p.risk)} />}
        </View>
      </View>
    </Card>
  )
}
