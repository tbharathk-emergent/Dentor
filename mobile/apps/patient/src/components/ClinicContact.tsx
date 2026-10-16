import { Button, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import { useContact } from '@/hooks/useContact'

/** "Call" / "Email" buttons for the clinic; a button is left out when the clinic has no such detail. */
export function ClinicContact({ phone, email, testID = 'clinic' }: { phone?: string; email?: string; testID?: string }) {
  const contact = useContact()
  if (!phone && !email) return null
  return (
    <View style={styles.row}>
      {!!phone && (
        <Button testID={`${testID}-call`} label={`Call ${phone}`} icon="phone" variant="secondary" onPress={() => contact.call(phone)} style={styles.button} />
      )}
      {!!email && (
        <Button testID={`${testID}-email`} label="Email the clinic" icon="mail" variant="outline" onPress={() => contact.email(email)} style={styles.button} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // Side by side when there is room, one per line on narrow phones.
  button: { flexGrow: 1, flexBasis: 220, alignSelf: 'auto' },
})
