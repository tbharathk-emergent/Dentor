import { EmptyState, QueryState, Screen, type IconName } from '@dentor/shared'
import { useEffect, useState } from 'react'
import { PatientHeader } from '@/components/PatientHeader'
import { TipBanner } from '@/components/home/TipBanner'
import { Rows } from '@/components/Rows'
import { SegmentTabs } from '@/components/SegmentTabs'
import { ClinicalItemCard } from '@/components/records/ClinicalItemCard'
import { DentalChart } from '@/components/records/DentalChart'
import { LabOrderCard } from '@/components/records/LabOrderCard'
import { useRecords } from '@/hooks/useRecords'
import { useRefresh } from '@/hooks/useRefresh'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'
import { useLocalSearchParams } from '@/nav'
import type { RecordsData } from '@/types'

type Section = 'treatments' | 'procedures' | 'chart' | 'lab'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'treatments', label: 'Treatments' },
  { key: 'procedures', label: 'Procedures' },
  { key: 'chart', label: 'Dental chart' },
  { key: 'lab', label: 'Lab work' },
]

const EMPTY: Record<Exclude<Section, 'chart'>, { icon: IconName; title: string; message: string }> = {
  treatments: { icon: 'clipboard', title: 'No treatments yet', message: 'Treatments your dentist plans or completes appear here.' },
  procedures: { icon: 'activity', title: 'No procedures yet', message: 'Procedures done during your visits appear here.' },
  lab: { icon: 'package', title: 'No lab work', message: 'Crowns, dentures and other lab orders made for you appear here.' },
}

export default function Records() {
  // The home screen's LAB tile opens this tab on "Lab work".
  const { tab } = useLocalSearchParams<{ tab?: string }>()
  const [section, setSection] = useState<Section>('treatments')
  useEffect(() => {
    if (SECTIONS.some((s) => s.key === tab)) setSection(tab as Section)
  }, [tab])
  const records = useRecords()
  const { refreshing, onRefresh } = useRefresh(records.refetch)
  useRefreshOnFocus(records.refetch)

  return (
    <Screen testID="records-screen" header={<PatientHeader />} refreshing={refreshing} onRefresh={onRefresh}>
      {/* design (frame "Lab record" 49:664): the day's tip above the list */}
      <TipBanner />
      <SegmentTabs options={SECTIONS} value={section} onChange={setSection} />
      <QueryState query={records}>{(data) => <RecordsSection section={section} data={data} />}</QueryState>
    </Screen>
  )
}

function RecordsSection({ section, data }: { section: Section; data: RecordsData }) {
  if (section === 'chart') return <DentalChart teeth={data.teeth} />

  const count = section === 'lab' ? data.lab_orders.length : data[section].length
  if (count === 0) return <EmptyState testID={`${section}-empty`} {...EMPTY[section]} />

  return (
    <Rows testID={`${section}-list`}>
      {section === 'lab'
        ? data.lab_orders.map((order) => <LabOrderCard key={order.id} order={order} />)
        : data[section].map((item) => <ClinicalItemCard key={item.id} item={item} testID={`${section}-item`} />)}
    </Rows>
  )
}
