import { Avatar, Badge, Card, EmptyState, StatusBadge, T, colors, space } from '@dentor/shared'
import { View } from 'react-native'
import { BadgeStack } from '@/components/BadgeStack'
import { Figure, FigureGrid } from '@/components/Figure'
import { fmtMoney } from '@/lib/format'
import type { DoctorPerformance } from '@/types'

function DoctorCard({ doctor }: { doctor: DoctorPerformance }) {
  const idle = doctor.appointments === 0 && doctor.billed === 0 && doctor.collected === 0
  return (
    <Card testID="doctor-card" style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <Avatar name={doctor.name} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T variant="bodyStrong" numberOfLines={1} testID="doctor-name">
            {doctor.name}
          </T>
          <T variant="small" color={colors.textMuted} numberOfLines={2}>
            {doctor.specialty || doctor.code}
          </T>
        </View>
        <BadgeStack>
          {!!doctor.type && <Badge label={doctor.type} tone={doctor.type === 'Visiting' ? 'violet' : 'brand'} />}
          {doctor.status !== 'Active' && <StatusBadge status={doctor.status} />}
        </BadgeStack>
      </View>
      {idle ? (
        <T variant="small" color={colors.textMuted} testID="doctor-idle">
          No appointments or billing in this period.
        </T>
      ) : (
        <FigureGrid>
          <Figure testID="doctor-appointments" label="APPOINTMENTS" value={doctor.appointments} />
          <Figure testID="doctor-completed" label="COMPLETED" value={doctor.completed} />
          <Figure testID="doctor-billed" label="BILLED" value={fmtMoney(doctor.billed)} />
          <Figure testID="doctor-collected" label="COLLECTED" value={fmtMoney(doctor.collected)} />
        </FigureGrid>
      )}
    </Card>
  )
}

/** One card per doctor for the chosen period, highest billing first (the API's order). */
export function DoctorList({ doctors }: { doctors: DoctorPerformance[] }) {
  if (doctors.length === 0) {
    return <EmptyState testID="doctors-empty" icon="users" title="No doctors yet" message="Doctors and visiting consultants added in the reception app appear here." />
  }
  return (
    <View testID="doctor-list" style={{ gap: space.md }}>
      {doctors.map((doctor) => (
        <DoctorCard key={doctor.id} doctor={doctor} />
      ))}
    </View>
  )
}
