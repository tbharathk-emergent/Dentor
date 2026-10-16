import { fmtDate, IconTile, ListRow } from '@dentor/shared'
import { dotJoin } from '@/lib/people'
import type { Prescription } from '@/types'

export function PrescriptionRow({
  prescription: rx,
  showPatient,
  onPress,
}: {
  prescription: Prescription
  /** My prescriptions list: lead with the patient. Patient record: lead with the diagnosis. */
  showPatient?: boolean
  onPress: () => void
}) {
  const count = `${rx.meds.length} medicine${rx.meds.length === 1 ? '' : 's'}`
  return (
    <ListRow
      testID={`rx-${rx.id}`}
      title={showPatient ? rx.patient : rx.diagnosis}
      subtitle={showPatient ? rx.diagnosis : dotJoin(rx.doctor, count)}
      meta={dotJoin(rx.code, fmtDate(rx.date), showPatient && count)}
      left={<IconTile icon="file-text" />}
      onPress={onPress}
      chevron
    />
  )
}
