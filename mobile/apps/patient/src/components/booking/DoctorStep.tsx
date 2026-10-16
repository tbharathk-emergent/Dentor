import { EmptyState, QueryState } from '@dentor/shared'
import { Rows } from '@/components/Rows'
import { DoctorCard } from '@/components/appointments/DoctorCard'
import type { useDoctors } from '@/hooks/useAppointments'
import type { Doctor } from '@/types'

/** Step 1: the clinic's bookable doctors. */
export function DoctorStep({
  doctors,
  selectedId,
  onSelect,
}: {
  doctors: ReturnType<typeof useDoctors>
  selectedId?: string
  onSelect: (doctor: Doctor) => void
}) {
  return (
    <QueryState query={doctors}>
      {(data) =>
        data.items.length === 0 ? (
          <EmptyState testID="doctors-empty" icon="user-x" title="No doctors to book" message="The clinic has not listed any doctors for online booking. Please call the clinic." />
        ) : (
          <Rows testID="doctors">
            {data.items.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} selected={doctor.id === selectedId} onPress={() => onSelect(doctor)} />
            ))}
          </Rows>
        )
      }
    </QueryState>
  )
}
