import { EmptyState, QueryState, Screen, TextField } from '@dentor/shared'
import { useState } from 'react'
import { ListCard } from '@/components/ListCard'
import { PatientRow } from '@/components/PatientRow'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePatients } from '@/hooks/usePatients'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus'
import { useRouter } from '@/nav'

export default function Patients() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim())
  const patients = usePatients(q)
  useRefetchOnFocus(patients.refetch)
  const pull = usePullToRefresh(patients.refetch)

  // While a new search is loading, the list still shows the previous results.
  const searching = patients.isPlaceholderData || search.trim() !== q
  const total = patients.data?.total
  return (
    <Screen
      testID="screen-patients"
      title="Patients"
      subtitle={total === undefined ? undefined : searching ? 'Searching…' : q ? `${total} matching “${q}”` : `${total} in your care`}
      {...pull}
    >
      <TextField
        testID="patient-search"
        icon="search"
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name, patient ID or mobile"
        autoCapitalize="none"
        maxLength={60}
      />
      <QueryState query={patients}>
        {(data) =>
          data.items.length === 0 ? (
            q ? (
              <EmptyState testID="patients-empty" icon="search" title="No patient found" message={`Nobody in your care matches “${q}”. Check the spelling, or search by patient ID or mobile number.`} action="Clear search" onAction={() => setSearch('')} />
            ) : (
              <EmptyState testID="patients-empty" icon="users" title="No patients yet" message="Patients appear here once they have an appointment or a referral booking with you." />
            )
          ) : (
            <ListCard testID="patient-list">
              {data.items.map((p) => (
                <PatientRow key={p.id} patient={p} onPress={() => router.push({ pathname: '/patients/[id]', params: { id: p.id } })} />
              ))}
            </ListCard>
          )
        }
      </QueryState>
    </Screen>
  )
}
