import { Card, colors, EmptyState, Section, space, T } from '@dentor/shared'
import { View } from 'react-native'
import { ListCard } from '@/components/ListCard'
import { RecordRow } from '@/components/RecordRow'
import type { PatientDetail } from '@/types'

/** The treatment plan and the procedures carried out, newest first (whoever recorded them). */
export function PatientTreatments({ detail, onAdd }: { detail: PatientDetail; onAdd: () => void }) {
  return (
    <View style={{ gap: space.lg }}>
      <Section title="Treatments">
        {detail.treatments.length === 0 ? (
          <EmptyState testID="treatments-empty" icon="clipboard" title="No treatments yet" message="Plan or record a treatment for this patient." action="Add treatment" onAction={onAdd} />
        ) : (
          <ListCard testID="treatment-list">
            {detail.treatments.map((t) => (
              <RecordRow key={t.id} record={t} testID={`treatment-${t.id}`} />
            ))}
          </ListCard>
        )}
      </Section>

      <Section title="Procedures">
        {detail.procedures.length === 0 ? (
          <Card testID="procedures-empty">
            <T variant="small" color={colors.textMuted}>No procedures recorded. Procedures are entered by the clinic during a visit.</T>
          </Card>
        ) : (
          <ListCard testID="procedure-list">
            {detail.procedures.map((p) => (
              <RecordRow key={p.id} record={p} testID={`procedure-${p.id}`} />
            ))}
          </ListCard>
        )}
      </Section>
    </View>
  )
}
