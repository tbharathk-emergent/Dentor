import { IconTile, T, colors, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import { ClinicContact } from '@/components/ClinicContact'
import type { Clinic } from '@/types'

const DEFAULT_REASON = 'Online booking is turned off for this clinic. Please call the clinic.'

/** Shown when the clinic has switched online booking off: say so, and offer the phone call instead. */
export function BookingClosed({ clinic, reason }: { clinic?: Clinic; reason?: string }) {
  return (
    <View testID="booking-closed" style={styles.wrap}>
      <IconTile icon="phone-call" tone="amber" size={64} />
      <T variant="h2" center>Booking in the app is off</T>
      <T color={colors.textMuted} center style={styles.text}>{reason || DEFAULT_REASON}</T>
      <T variant="small" color={colors.textMuted} center style={styles.text}>
        Your existing appointments are not affected.
      </T>
      <View style={styles.actions}>
        <ClinicContact phone={clinic?.phone} testID="booking-closed" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  text: { maxWidth: 360 },
  actions: { alignSelf: 'stretch', marginTop: space.sm },
})
