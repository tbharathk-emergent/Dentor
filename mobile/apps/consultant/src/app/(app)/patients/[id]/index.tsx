import { QueryState, Screen } from '@dentor/shared'
import { useState } from 'react'
import { AllergyBanner } from '@/components/AllergyBanner'
import { PatientActions } from '@/components/patient/PatientActions'
import { PatientFiles } from '@/components/patient/PatientFiles'
import { PatientHeaderCard } from '@/components/patient/PatientHeaderCard'
import { PatientOverview } from '@/components/patient/PatientOverview'
import { PatientPrescriptions } from '@/components/patient/PatientPrescriptions'
import { PatientTreatments } from '@/components/patient/PatientTreatments'
import { ScrollTabs } from '@/components/ScrollTabs'
import { ToothChart } from '@/components/ToothChart'
import { usePatient } from '@/hooks/usePatients'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus'
import { useLocalSearchParams, useRouter } from '@/nav'

type SegmentKey = 'overview' | 'treatments' | 'prescriptions' | 'files' | 'chart'

export default function PatientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const query = usePatient(id)
  useRefetchOnFocus(query.refetch)
  const pull = usePullToRefresh(query.refetch)
  const [segment, setSegment] = useState<SegmentKey>('overview')

  const prescribe = () => router.push({ pathname: '/patients/[id]/prescribe', params: { id } })
  const addTreatment = () => router.push({ pathname: '/patients/[id]/treatment', params: { id } })

  return (
    <Screen
      testID="screen-patient"
      title={query.data?.patient.name ?? 'Patient'}
      subtitle={query.data?.patient.code}
      back
      {...pull}
    >
      <QueryState query={query}>
        {(detail) => (
          <>
            <PatientHeaderCard patient={detail.patient} />
            <AllergyBanner allergy={detail.patient.allergy} />
            <PatientActions onPrescribe={prescribe} onAddTreatment={addTreatment} />
            <ScrollTabs<SegmentKey>
              value={segment}
              onChange={setSegment}
              options={[
                { key: 'overview', label: 'Overview' },
                { key: 'treatments', label: 'Treatments', count: detail.treatments.length },
                { key: 'prescriptions', label: 'Prescriptions', count: detail.prescriptions.length },
                { key: 'files', label: 'Files', count: detail.files.length },
                { key: 'chart', label: 'Chart' },
              ]}
            />
            {segment === 'overview' && (
              <PatientOverview detail={detail} onOpenAppointment={(appointmentId) => router.push({ pathname: '/appointments/[id]', params: { id: appointmentId } })} />
            )}
            {segment === 'treatments' && <PatientTreatments detail={detail} onAdd={addTreatment} />}
            {segment === 'prescriptions' && (
              <PatientPrescriptions
                prescriptions={detail.prescriptions}
                onWrite={prescribe}
                onOpen={(rxId) => router.push({ pathname: '/prescriptions/[id]', params: { id: rxId, patientId: id } })}
              />
            )}
            {segment === 'files' && (
              <PatientFiles files={detail.files} onOpen={(fileId) => router.push({ pathname: '/patients/[id]/files/[fileId]', params: { id, fileId } })} />
            )}
            {segment === 'chart' && <ToothChart teeth={detail.teeth} />}
          </>
        )}
      </QueryState>
    </Screen>
  )
}
