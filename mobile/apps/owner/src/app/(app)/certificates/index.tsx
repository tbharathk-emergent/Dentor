import { Button, EmptyState, ListRow, QueryState, Screen, Segmented, Sheet, TextField, fmtDate, space, useSession } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { useCertificates } from '@/clinic/clinical'
import { useRefresh } from '@/hooks/useRefresh'
import { can } from '@/lib/access'
import { useRouter } from '@/nav'
import type { StaffSession } from '@/types'

/** Certificates (dentor.fig 317–319): fitness and referral, search, view; "Add Certificate" asks which kind. */
export default function Certificates() {
  const router = useRouter()
  const role = useSession<StaffSession>().data?.user?.role
  const [type, setType] = useState<'Fitness' | 'Referral'>('Fitness')
  const [q, setQ] = useState('')
  const [choosing, setChoosing] = useState(false)
  const list = useCertificates(type, q.trim())
  const { refreshing, refresh } = useRefresh(list)
  const issue = (t: 'Fitness' | 'Referral') => { setChoosing(false); router.push({ pathname: '/certificates/new', params: { type: t } }) }
  return (
    <Screen testID="certificates-screen" title="Certificates" back refreshing={refreshing} onRefresh={refresh}
      footer={can(role, 'clinical') ? <Button testID="certificate-add" label="Add Certificate" icon="plus" size="lg" full onPress={() => setChoosing(true)} /> : undefined}>
      <Segmented options={[{ key: 'Fitness', label: 'Fitness Certificate' }, { key: 'Referral', label: 'Referral Certificate' }]} value={type} onChange={setType} />
      <TextField testID="certificate-search" icon="search" value={q} onChangeText={setQ} placeholder="Search" autoCapitalize="none" />
      <QueryState query={list}>
        {(data) => data.items.length ? (
          <View style={{ gap: space.xs }}>
            {data.items.map((c) => (
              <ListRow key={c.id} testID={`certificate-${c.code}`} title={c.patient} subtitle={`${c.doctor} · ${fmtDate(c.date)}`} meta={c.code} chevron
                onPress={() => router.push({ pathname: '/certificates/[id]', params: { id: c.id } })} />
            ))}
          </View>
        ) : <EmptyState icon="award" title={`No ${type.toLowerCase()} certificates yet`} />}
      </QueryState>
      <Sheet testID="certificate-kind" visible={choosing} onClose={() => setChoosing(false)} title="Select an option to proceed">
        <Button testID="certificate-kind-fitness" label="Fitness certificate" variant="secondary" full onPress={() => issue('Fitness')} />
        <Button testID="certificate-kind-referral" label="Referral Certificate" variant="secondary" full onPress={() => issue('Referral')} />
      </Sheet>
    </Screen>
  )
}
