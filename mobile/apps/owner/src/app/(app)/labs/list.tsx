import { EmptyState, ListRow, QueryState, Screen, useLocalSearchParams } from '@dentor/shared'
import { View } from 'react-native'
import { useLabs, type LabType } from '@/clinic/clinical'
import { useRouter } from '@/nav'

/** "Blood Investigation Labs", "X-RAY LABS", "DENTAL LABS", "CBCT LABS" (dentor.fig 161–164). */
export default function LabList() {
  const { type } = useLocalSearchParams<{ type: LabType }>()
  const router = useRouter()
  const labs = useLabs(type)
  return (
    <Screen pattern testID="lab-list-screen" title={`${type} Labs`} back>
      <QueryState query={labs}>
        {(data) => data.items.length ? (
          <View style={{ gap: 6 }}>
            {data.items.map((l) => (
              <ListRow key={l.id} testID={`lab-${l.name}`} title={l.name} subtitle={[l.city, l.rating ? `${l.rating}★` : '', `${l.turnaround_days} day turnaround`].filter(Boolean).join(' · ')}
                meta={l.services.join(', ')} chevron onPress={() => router.push({ pathname: '/labs/[id]', params: { id: l.id } })} />
            ))}
          </View>
        ) : <EmptyState icon="search" title="No labs of this kind" message="The clinic's owner adds labs in the reception web app." />}
      </QueryState>
    </Screen>
  )
}
