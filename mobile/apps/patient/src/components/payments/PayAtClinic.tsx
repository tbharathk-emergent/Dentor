import { Banner, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import { ClinicContact } from '@/components/ClinicContact'

/** The app does not take payments: say so plainly and offer the call. */
export function PayAtClinic({ phone, outstanding }: { phone?: string; outstanding: number }) {
  const text =
    outstanding > 0
      ? 'Bills are paid at the clinic. Pay at the front desk on your next visit, or call the clinic to ask about your balance.'
      : 'Bills are paid at the clinic. The app shows your bills and receipts; it does not take payments.'
  return (
    <View testID="pay-at-clinic" style={styles.wrap}>
      <Banner tone="blue" icon="info" text={text} />
      <ClinicContact phone={phone} testID="pay" />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
})
