import { ErrorState, Screen, Section, SkeletonList, StatTile, TileGrid } from '@dentor/shared'
import { useLabs, type LabType } from '@/clinic/clinical'
import { useRefresh } from '@/hooks/useRefresh'
import { useRouter } from '@/nav'

const TYPES: { type: LabType; label: string; hint: string; icon: 'droplet' | 'image' | 'tool' | 'box' }[] = [
  { type: 'Blood', label: 'Blood Investigation Labs', hint: 'Blood tests & screening', icon: 'droplet' },
  { type: 'X-ray', label: 'X-ray Labs', hint: 'IOPA, OPG, ceph', icon: 'image' },
  { type: 'Dental', label: 'Dental Labs', hint: 'Crowns, bridges, dentures', icon: 'tool' },
  { type: 'CBCT', label: 'CBCT Labs', hint: '3D scans & referral', icon: 'box' },
]

/** "LABS" (dentor.fig 159, 160): diagnostic labs by kind, ongoing cases, complaints and invoices. */
export default function LabsHome() {
  const router = useRouter()
  const labs = useLabs()
  const { refreshing, refresh } = useRefresh(labs)
  return (
    <Screen pattern testID="labs-screen" title="Labs" back refreshing={refreshing} onRefresh={refresh}>
      {labs.isLoading ? <SkeletonList rows={2} /> : labs.isError ? <ErrorState error={labs.error} onRetry={() => labs.refetch()} /> : (
        <Section title="Diagnostic Labs">
          <TileGrid>
            {TYPES.map((t) => (
              <StatTile key={t.type} testID={`labs-${t.type}`} label={t.label} value={labs.data?.counts[t.type] ?? 0} hint={t.hint} icon={t.icon}
                onPress={() => router.push({ pathname: '/labs/list', params: { type: t.type } })} />
            ))}
          </TileGrid>
        </Section>
      )}
      <Section title="Cases">
        <TileGrid>
          <StatTile testID="labs-ongoing" label="Ongoing Cases" value="Open" icon="activity" tone="blue" onPress={() => router.push('/labs/orders')} />
          <StatTile testID="labs-complaints" label="Complaints" value="Open" icon="alert-triangle" tone="amber" onPress={() => router.push('/labs/complaints')} />
          <StatTile testID="labs-invoices" label="Invoices" value="Open" icon="file-text" tone="green" onPress={() => router.push('/labs/invoices')} />
        </TileGrid>
      </Section>
    </Screen>
  )
}
