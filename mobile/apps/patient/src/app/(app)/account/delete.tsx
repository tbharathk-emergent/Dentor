import { ApiError, Banner, Button, Card, ConfirmSheet, Screen, T, TextField, colors, errorMessage, space, useSession, useToast } from '@dentor/shared'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useDeleteAccount } from '@/hooks/useAccount'
import type { PatientSession } from '@/types'

const CONSEQUENCES = [
  'Your app login is removed. You will be logged out on every device.',
  'Your dental records, prescriptions, reports and bills stay with the clinic, which keeps them as part of your care.',
  'Appointments you have booked are not cancelled. Call the clinic if you need to change them.',
  'You can sign up again later with the same mobile number to see your records.',
]

export default function DeleteAccount() {
  const toast = useToast()
  const { data: session, signOut } = useSession<PatientSession>()
  const remove = useDeleteAccount()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [confirming, setConfirming] = useState(false)

  const ask = () => {
    if (!password) {
      setError('Enter your password to confirm it is you.')
      return
    }
    setError(undefined)
    setConfirming(true)
  }

  const confirmDelete = () =>
    remove.mutate(password, {
      onSuccess: async () => {
        toast.success('Your account was deleted')
        await signOut()
      },
      onError: (failure) => {
        setConfirming(false)
        // 400 = wrong password: show it on the field. Anything else is a toast.
        if (failure instanceof ApiError && failure.status === 400) setError(errorMessage(failure))
        else toast.error(failure)
      },
    })

  return (
    <Screen
      testID="delete-account-screen"
      title="Delete account"
      back
      footer={<Button testID="delete-submit" label="Delete my account" variant="danger" size="lg" full onPress={ask} />}
    >
      <Banner tone="red" icon="alert-triangle" text="This removes your login to the app. It cannot be undone." />
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
        hint={session?.account?.mobile ? `For the account on +91 ${session.account.mobile}` : undefined}
        onSubmitEditing={ask}
      />
      <ConfirmSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={confirmDelete}
        title="Delete your account?"
        message="Your app login will be removed and you will be logged out. Your records stay with the clinic."
        confirmLabel="Delete account"
        danger
        loading={remove.isPending}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  point: { flexDirection: 'row', gap: space.sm },
  pointText: { flex: 1 },
})
