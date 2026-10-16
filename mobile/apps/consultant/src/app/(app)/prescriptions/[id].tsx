import { Card, colors, fmtDate, KeyValue, QueryState, Screen, space, StatusBadge, T } from '@dentor/shared'
import { View } from 'react-native'
import { PrescriptionSummary } from '@/components/PrescriptionSummary'
import { usePrescription } from '@/hooks/usePrescriptions'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { ageGender, dotJoin } from '@/lib/people'
import { useLocalSearchParams } from '@/nav'

export default function PrescriptionScreen() {
  // `patientId` is present when the prescription was opened from a patient's record.
  const { id, patientId } = useLocalSearchParams<{ id: string; patientId?: string }>()
  const query = usePrescription(id, patientId)
  const pull = usePullToRefresh(query.refetch)
  return (
    <Screen
      testID="screen-prescription"
      title={query.data?.code ?? 'Prescription'}
      subtitle={query.data ? fmtDate(query.data.date) : undefined}
      back
      {...pull}
    >
      <QueryState query={query}>
        {(rx) => (
          <>
            <Card testID="rx-header" style={{ gap: space.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T variant="h3" numberOfLines={2} testID="rx-patient">{rx.patient}</T>
                  <T variant="small" color={colors.textMuted}>{dotJoin(rx.patientCode, ageGender(rx))}</T>
                </View>
                <StatusBadge status={rx.status} />
              </View>
              <KeyValue label="Prescription" value={rx.code} />
              <KeyValue label="Issued on" value={fmtDate(rx.date)} />
              <View testID="rx-doctor">
                <KeyValue label="Prescribed by" value={rx.doctor} />
              </View>
            </Card>
            <PrescriptionSummary content={rx} allergy={rx.allergy} />
          </>
        )}
      </QueryState>
    </Screen>
  )
}
