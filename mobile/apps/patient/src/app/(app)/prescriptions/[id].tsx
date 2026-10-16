import { QueryState, Screen } from '@dentor/shared'
import { PrescriptionDetails } from '@/components/prescriptions/PrescriptionDetails'
import { usePrescription } from '@/hooks/usePrescriptions'
import { useRefresh } from '@/hooks/useRefresh'
import { useLocalSearchParams } from '@/nav'

export default function PrescriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const prescription = usePrescription(id)
  const { refreshing, onRefresh } = useRefresh(prescription.refetch)

  return (
    <Screen testID="prescription-screen" title="Prescription" back refreshing={refreshing} onRefresh={onRefresh}>
      <QueryState query={prescription}>{(data) => <PrescriptionDetails prescription={data} />}</QueryState>
    </Screen>
  )
}
