import { EmptyState, ListRow, QueryState, Sheet, TextField, space } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { usePatients } from '@/clinic/hooks'
import type { PatientRow } from '@/clinic/types'

/** Search the clinic's patients by name, code or mobile and choose one. */
export function PatientPicker({ visible, onClose, onPick, onAdd }: { visible: boolean; onClose: () => void; onPick: (p: PatientRow) => void; onAdd?: () => void }) {
  const [q, setQ] = useState('')
  const list = usePatients(q.trim())
  return (
    <Sheet testID="patient-picker" visible={visible} onClose={onClose} title="Choose a patient" subtitle="Search by name, patient ID or mobile">
      <TextField testID="patient-search" icon="search" value={q} onChangeText={setQ} placeholder="Search patients" autoCapitalize="none" />
      <QueryState query={list}>
        {(data) =>
          data.items.length ? (
            <View style={{ gap: space.xs }}>
              {data.items.slice(0, 20).map((p) => (
                <ListRow key={p.id} testID={`pick-${p.code}`} title={p.name} subtitle={`${p.code} · ${p.mobile}`} chevron onPress={() => onPick(p)} />
              ))}
            </View>
          ) : (
            <EmptyState title="No patient found" message="Check the spelling, or add the patient." action={onAdd ? 'Add patient' : undefined} onAction={onAdd} />
          )
        }
      </QueryState>
    </Sheet>
  )
}
