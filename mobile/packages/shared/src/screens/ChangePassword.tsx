import { useRouter } from '../navigation'
import { useState } from 'react'
import { api } from '../api'
import { useSession } from '../session'
import { useToast } from '../ui/feedback'
import { Screen } from '../ui/layout'
import { Banner, Button, TextField } from '../ui/primitives'

/**
 * Change-password form. `endpoint` is "/api/auth/change-password" for staff logins and
 * "/api/patient/account/change-password" for patients; both answer with a fresh session,
 * and every other device is signed out.
 *
 * The form checks what the API checks and nothing else. Eight characters is the API's
 * minimum everywhere; `check` adds the rest of the rule where the app can know it (the
 * patient rule is fixed; a staff password also depends on the clinic's strong-password rule,
 * which only the API can apply, and its refusal is shown as it comes).
 */
export function ChangePasswordScreen({
  endpoint,
  rule,
  check,
}: {
  endpoint: string
  /** The password rule in words, shown above the fields. */
  rule: string
  /** What is wrong with a new password of eight or more characters, or undefined. */
  check?: (password: string) => string | undefined
}) {
  const router = useRouter()
  const toast = useToast()
  const { signIn } = useSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const e: typeof errors = {}
    if (!current) e.current = 'Enter your current password.'
    const problem = next.length < 8 ? 'Use at least 8 characters.' : check?.(next)
    if (problem) e.next = problem
    if (confirm !== next) e.confirm = 'The two new passwords do not match.'
    setErrors(e)
    if (Object.keys(e).length || busy) return
    setBusy(true)
    try {
      const payload = await api.post(endpoint, { current_password: current, new_password: next })
      if (payload?.access_token) await signIn(payload)
      toast.success('Password changed')
      if (router.canGoBack()) router.back()
    } catch (err) {
      toast.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen
      title="Change password"
      back
      footer={<Button testID="change-password-submit" label="Update password" onPress={submit} loading={busy} full size="lg" />}
    >
      <Banner tone="blue" icon="shield" text={`${rule} Your other devices will ask for the new password.`} />
      <TextField testID="current-password" label="Current password" required secure value={current} onChangeText={setCurrent} error={errors.current} />
      <TextField testID="new-password" label="New password" required secure value={next} onChangeText={setNext} error={errors.next} />
      <TextField testID="confirm-password" label="Confirm new password" required secure value={confirm} onChangeText={setConfirm} error={errors.confirm} onSubmitEditing={submit} />
    </Screen>
  )
}
