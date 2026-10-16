import { Button, Card, StatusBadge, T, colors, fmtDate, fmtDateTime, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import type { Consent } from '@/types'

/** A consent form from the clinic; one that is still pending carries the button to sign it. */
export function ConsentCard({ consent, onSign }: { consent: Consent; onSign: () => void }) {
  const pending = consent.status === 'Pending'
  return (
    <Card testID={`consent-card-${consent.id}`} style={styles.card}>
      <View style={styles.head}>
        <View style={styles.title}>
          <T variant="bodyStrong">{consent.title}</T>
          <T variant="small" color={colors.textMuted}>{fmtDate(consent.date)}</T>
        </View>
        <View testID={`consent-status-${consent.id}`}>
          <StatusBadge status={consent.status} />
        </View>
      </View>
      {!!consent.notes && <T variant="small">{consent.notes}</T>}
      {!!consent.signedAt && <T variant="small" color={colors.textMuted}>Signed in the app on {fmtDateTime(consent.signedAt)}</T>}
      {pending && <Button testID={`consent-sign-${consent.id}`} label="Review and sign" icon="edit-3" full onPress={onSign} />}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  title: { flex: 1, minWidth: 0, gap: 2 },
})
