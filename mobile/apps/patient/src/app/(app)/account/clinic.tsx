import { Banner, Card, KeyValue, QueryState, Screen, T, ToothMark, colors, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import { ClinicContact } from '@/components/ClinicContact'
import { useMe } from '@/hooks/useMe'
import { useRefresh } from '@/hooks/useRefresh'

export default function ClinicInfo() {
  const me = useMe()
  const { refreshing, onRefresh } = useRefresh(me.refetch)

  return (
    <Screen testID="clinic-screen" title="Clinic information" back refreshing={refreshing} onRefresh={onRefresh}>
      <QueryState query={me}>
        {({ clinic }) => (
          <>
            <Card style={styles.head}>
              <ToothMark size={56} />
              <View style={styles.title}>
                <T variant="h2" testID="clinic-name">{clinic.name}</T>
                {!!clinic.code && <T variant="small" color={colors.textMuted}>{clinic.code}</T>}
              </View>
            </Card>
            <Card>
              <KeyValue label="Address" value={clinic.address} />
              <KeyValue label="City" value={clinic.city} />
              <KeyValue label="Phone" value={clinic.phone} />
              <KeyValue label="Email" value={clinic.email} />
            </Card>
            <ClinicContact phone={clinic.phone} email={clinic.email} />
            <Banner
              tone={clinic.online_booking ? 'green' : 'amber'}
              icon={clinic.online_booking ? 'check-circle' : 'phone-call'}
              text={clinic.online_booking ? 'This clinic accepts bookings made in the app.' : 'This clinic is not taking bookings in the app right now. Please call to book a visit.'}
            />
          </>
        )}
      </QueryState>
    </Screen>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  title: { flex: 1, minWidth: 0, gap: 2 },
})
