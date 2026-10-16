import { EmptyState, QueryState, Screen } from '@dentor/shared'
import { Rows } from '@/components/Rows'
import { PrescriptionCard } from '@/components/prescriptions/PrescriptionCard'
import { usePrescriptions } from '@/hooks/usePrescriptions'
import { useRefresh } from '@/hooks/useRefresh'
import { useRouter } from '@/nav'

export default function Prescriptions() {
  const router = useRouter()
  const list = usePrescriptions()
  const { refreshing, onRefresh } = useRefresh(list.refetch)

  return (
    <Screen testID="prescriptions-screen" title="Prescriptions" back refreshing={refreshing} onRefresh={onRefresh}>
      <QueryState query={list}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState testID="prescriptions-empty" icon="file-text" title="No prescriptions yet" message="Prescriptions your dentist writes appear here." />
          ) : (
            <Rows testID="prescription-list">
              {data.items.map((prescription) => (
                <PrescriptionCard
                  key={prescription.id}
                  prescription={prescription}
                  onPress={() => router.push({ pathname: '/prescriptions/[id]', params: { id: prescription.id } })}
                />
              ))}
            </Rows>
          )
        }
      </QueryState>
    </Screen>
  )
}
