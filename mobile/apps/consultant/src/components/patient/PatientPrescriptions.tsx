import { EmptyState } from '@dentor/shared'
import { ListCard } from '@/components/ListCard'
import { PrescriptionRow } from '@/components/PrescriptionRow'
import type { Prescription } from '@/types'

/** Every prescription on the patient's record, newest first. */
export function PatientPrescriptions({ prescriptions, onOpen, onWrite }: { prescriptions: Prescription[]; onOpen: (id: string) => void; onWrite: () => void }) {
  if (prescriptions.length === 0) {
    return <EmptyState testID="patient-rx-empty" icon="file-text" title="No prescriptions yet" message="Prescriptions written for this patient appear here." action="Write prescription" onAction={onWrite} />
  }
  return (
    <ListCard testID="patient-rx-list">
      {prescriptions.map((rx) => (
        <PrescriptionRow key={rx.id} prescription={rx} onPress={() => onOpen(rx.id)} />
      ))}
    </ListCard>
  )
}
