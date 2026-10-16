import { Avatar, Card, Divider, EmptyState, ListRow, StatusBadge, space } from '@dentor/shared'
import { View } from 'react-native'
import type { StaffMember } from '@/types'

const AVATAR = 40

/** Everyone on the clinic's staff list, with role, department and contact number. */
export function StaffDirectory({ staff }: { staff: StaffMember[] }) {
  if (staff.length === 0) {
    return <EmptyState testID="staff-empty" icon="users" title="No staff yet" message="Staff records added in the reception app appear here." />
  }
  return (
    <Card padded={false} testID="staff-list">
      {staff.map((member, index) => (
        <View key={member.id}>
          {index > 0 && <Divider inset={space.lg + AVATAR + space.md} />}
          <ListRow
            testID="staff-member"
            left={<Avatar name={member.name} size={AVATAR} />}
            title={member.name}
            subtitle={[member.role, member.department].filter(Boolean).join(' · ')}
            meta={[member.code, member.employment, member.mobile].filter(Boolean).join(' · ')}
            right={<StatusBadge status={member.status} />}
          />
        </View>
      ))}
    </Card>
  )
}
