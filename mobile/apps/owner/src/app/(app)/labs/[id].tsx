import { Badge, Button, Card, KeyValue, QueryState, Row, Screen, Section, T, colors, space, useLocalSearchParams, useSession } from '@dentor/shared'
import { View } from 'react-native'
import { useLab } from '@/clinic/clinical'
import { can } from '@/lib/access'
import { useRouter } from '@/nav'
import type { StaffSession } from '@/types'

/** "Lab profile" (dentor.fig 8, 165): rating, about, services and "Book This Lab". */
export default function LabProfile() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const role = useSession<StaffSession>().data?.user?.role
  const lab = useLab(id)
  return (
    <Screen pattern testID="lab-profile-screen" title="Lab profile" back
      footer={can(role, 'front-desk') ? <Button testID="lab-book" label="Book This Lab" size="lg" full onPress={() => router.push({ pathname: '/labs/book/[id]', params: { id } })} /> : undefined}>
      <QueryState query={lab}>
        {(l) => (
          <>
            <View style={{ alignItems: 'center', gap: space.xs }}>
              <T variant="h2">{l.name}</T>
              <T variant="small" color={colors.textMuted}>{l.rating ? `(${l.rating} Rating)` : ''} {l.type} lab</T>
            </View>
            <Section title="About"><T>{l.about}</T></Section>
            <Section title="Services"><Row wrap gap={space.sm}>{l.services.map((s) => <Badge key={s} label={s} tone="brand" />)}</Row></Section>
            <Card>
              <KeyValue label="City" value={l.city} />
              <KeyValue label="Phone" value={l.phone} />
              <KeyValue label="Turnaround" value={`${l.turnaround_days} days`} />
              <KeyValue label="Orders from this clinic" value={String(l.orders ?? 0)} />
            </Card>
          </>
        )}
      </QueryState>
    </Screen>
  )
}
