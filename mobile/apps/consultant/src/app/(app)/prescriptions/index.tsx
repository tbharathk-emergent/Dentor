import { EmptyState, QueryState, Screen } from '@dentor/shared'
import { ListCard } from '@/components/ListCard'
import { PrescriptionRow } from '@/components/PrescriptionRow'
import { useMyPrescriptions } from '@/hooks/usePrescriptions'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus'
import { useRouter } from '@/nav'

export default function MyPrescriptions() {
  const router = useRouter()
  const query = useMyPrescriptions()
  useRefetchOnFocus(query.refetch)
  const pull = usePullToRefresh(query.refetch)
  const count = query.data?.items.length
  return (
    <Screen
      testID="screen-prescriptions"
      title="My prescriptions"
      subtitle={count === undefined ? undefined : `${count} written by you`}
      back
      {...pull}
    >
      <QueryState query={query}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState testID="prescriptions-empty" icon="file-text" title="No prescriptions yet" message="Open a patient and choose Write prescription. Everything you issue is listed here." />
          ) : (
            <ListCard testID="prescription-list">
              {data.items.map((rx) => (
                <PrescriptionRow key={rx.id} prescription={rx} showPatient onPress={() => router.push({ pathname: '/prescriptions/[id]', params: { id: rx.id } })} />
              ))}
            </ListCard>
          )
        }
      </QueryState>
    </Screen>
  )
}
