import { EmptyState, QueryState, TextField } from '@dentor/shared'
import { useState } from 'react'
import { Rows } from '@/components/Rows'
import { ClinicOption } from '@/components/setup/ClinicOption'
import { useDebounced } from '@/hooks/useDebounced'
import { useClinicDirectory } from '@/hooks/useProfiles'
import type { ClinicListing } from '@/types'

/** Search box plus the clinics that accept registrations from the app. */
export function ClinicSearch({ selected, onSelect }: { selected: ClinicListing | null; onSelect: (clinic: ClinicListing) => void }) {
  const [text, setText] = useState('')
  const search = useDebounced(text.trim())
  const clinics = useClinicDirectory(search)

  return (
    <>
      <TextField testID="search-clinics" icon="search" value={text} onChangeText={setText} placeholder="Search by clinic name or city" autoCapitalize="none" />
      <QueryState query={clinics}>
        {(data) =>
          data.items.length > 0 ? (
            <Rows testID="clinics">
              {data.items.map((clinic) => (
                <ClinicOption key={clinic.id} clinic={clinic} selected={clinic.id === selected?.id} onPress={() => onSelect(clinic)} />
              ))}
            </Rows>
          ) : search ? (
            <EmptyState testID="clinics-empty" icon="search" title={`No clinic matches “${search}”`} message="Check the spelling, or try the city instead of the clinic's name." />
          ) : (
            <EmptyState
              testID="clinics-empty"
              title="No clinic accepts app registrations yet"
              message="Ask your clinic to switch on online booking, then try again."
              action="Check again"
              onAction={() => clinics.refetch()}
            />
          )
        }
      </QueryState>
    </>
  )
}
