import { Badge, Card, EmptyState, QueryState, Row, Screen, T, TextField, colors, space } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { useRevisits } from '@/clinic/hooks'
import { useRefresh } from '@/hooks/useRefresh'
import { useRouter } from '@/nav'

/**
 * "Re-Visit" (dentor.fig 3879:2429): patients whose treatment was completed, newest first, with the
 * treatment, when it was done and the last visit. Opening one goes to the patient, to book the next visit.
 */
export default function Revisit() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const list = useRevisits(q.trim())
  const { refreshing, refresh } = useRefresh(list)
  return (
    <Screen testID="revisit-screen" title="Re-Visit" back refreshing={refreshing} onRefresh={refresh}>
      <TextField testID="revisit-search" icon="search" value={q} onChangeText={setQ} placeholder="Search by name or patient ID" autoCapitalize="none" />
      <QueryState query={list}>
        {(data) => data.items.length ? (
          <View style={{ gap: space.md }}>
            {data.items.map((r) => (
              <Card key={r.patient_code} testID={`revisit-${r.patient_code}`} stripe={colors.green}
                onPress={r.patient_id ? () => router.push({ pathname: '/patients/[id]', params: { id: r.patient_id } }) : undefined}>
                <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="h3" numberOfLines={1}>{r.patient}</T>
                    <T variant="small" color={colors.textMuted}>{r.patient_code}</T>
                    <T variant="small" color={colors.textMuted}>{[r.date_label, r.time_label].filter(Boolean).join(' · ')}</T>
                    {!!r.last_visit_label && <T variant="small" color={colors.textMuted} testID={`revisit-last-${r.patient_code}`}>Last visit on {r.last_visit_label}</T>}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: space.xs, maxWidth: '45%' }}>
                    <T variant="smallStrong" color={colors.header} numberOfLines={2} style={{ textAlign: 'right' }}>{r.treatment}</T>
                    <Badge label="Completed" tone="green" />
                  </View>
                </Row>
              </Card>
            ))}
          </View>
        ) : <EmptyState icon="rotate-ccw" title={q.trim() ? 'No patient matches' : 'No completed treatments yet'} />}
      </QueryState>
    </Screen>
  )
}
