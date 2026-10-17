import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { ApiError, api, errorMessage } from '../../api'
import { useSession } from '../../session'
import { colors, space } from '../../theme'
import { ConfirmSheet, useToast } from '../../ui/feedback'
import { Screen } from '../../ui/layout'
import { Banner, Button, Card, T, TextField } from '../../ui/primitives'

const CONSEQUENCES = [
  'Your login stops working at once, and you are logged out on every device.',
  'You disappear from the clinic’s staff list, and the app stops sending you emails and notifications.',
  'The clinic keeps its records: patients, appointments, prescriptions and bills you worked on stay with the clinic.',
  'Changed your mind? Dentor support can restore the login (see the account deletion page, linked from the Privacy Policy).',
]

/**
 * "Delete my account" for the Clinic Owner and Consultant apps. The API soft-deletes the login
 * (backend app/account_deletion.py): it is hidden and stops working, and a Super Admin can restore it.
 */
export function StaffDeleteAccountScreen() {
  const toast = useToast()
  const { data: session, signOut } = useSession<{ user?: { email?: string } | null }>()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const ask = () => {
    if (!password) {
      setError('Enter your password to confirm it is you.')
      return
    }
    setError(undefined)
    setConfirming(true)
  }

  const confirmDelete = async () => {
    if (busy) return
    setBusy(true)
    try {
      await api.post('/api/auth/account/delete', { password })
      toast.success('Your account was deleted')
      await signOut()
    } catch (failure) {
      setConfirming(false)
      // 400 = wrong password: shown on the field. 409 (the clinic's only administrator) and the rest: a banner-like toast.
      if (failure instanceof ApiError && failure.status === 400) setError(errorMessage(failure))
      else toast.error(failure)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen
      testID="delete-account-screen"
      title="Delete account"
      back
      footer={<Button testID="delete-submit" label="Delete my account" variant="danger" size="lg" full onPress={ask} />}
    >
      <Banner tone="red" icon="alert-triangle" text="This deletes your login to the Dentor apps." />
      <Card style={styles.card}>
        <T variant="h3">What happens</T>
        {CONSEQUENCES.map((line) => (
          <View key={line} style={styles.point}>
            <T color={colors.textMuted}>•</T>
            <T color={colors.textMuted} style={styles.pointText}>{line}</T>
          </View>
        ))}
      </Card>
      <TextField
        testID="delete-password"
        label="Your password"
        required
        secure
        icon="lock"
        value={password}
        onChangeText={(text) => {
          setPassword(text)
          setError(undefined)
        }}
        error={error}
        hint={session?.user?.email ? `For the login ${session.user.email}` : undefined}
        onSubmitEditing={ask}
      />
      <ConfirmSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={confirmDelete}
        title="Delete your account?"
        message="Your login will stop working and you will be logged out. The clinic keeps its records."
        confirmLabel="Delete account"
        danger
        loading={busy}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  point: { flexDirection: 'row', gap: space.sm },
  pointText: { flex: 1 },
})
