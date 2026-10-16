import { Avatar, Badge, ListRow } from '@dentor/shared'
import { ageGender, dotJoin } from '@/lib/people'
import type { PatientSummary } from '@/types'

/** One patient in a list: avatar, name, code, age and gender, and an allergy flag. */
export function PatientRow({ patient: p, onPress }: { patient: PatientSummary; onPress: () => void }) {
  return (
    <ListRow
      testID={`patient-${p.code}`}
      title={p.name}
      subtitle={dotJoin(p.code, ageGender(p))}
      meta={p.treatment || undefined}
      left={<Avatar name={p.name} uri={p.photo || undefined} />}
      right={p.allergy ? <Badge testID={`patient-${p.code}-allergy`} label="Allergy" tone="red" /> : undefined}
      onPress={onPress}
      chevron
    />
  )
}
