import { Banner, Button, Sheet, TextField, errorMessage, useToast } from '@dentor/shared'
import { FormError } from '@/components/FormError'
import { useResetLoginPassword } from '@/hooks/useLogins'
import { useLastValue, useSheetForm } from '@/hooks/useSheetForm'
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from '@/lib/validation'
import type { ClinicLogin } from '@/types'

/** Sets a new password for someone else's login. */
export function ResetPasswordSheet({ login, onClose }: { login: ClinicLogin | null; onClose: () => void }) {
  const toast = useToast()
  const reset = useResetLoginPassword()
  const subject = useLastValue(login)
  const [form, update] = useSheetForm(login?.id ?? null, () => ({ password: '', error: '', failure: '' }))

  const submit = () => {
    if (!subject) return
    const error = form.password.length < MIN_PASSWORD_LENGTH ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : ''
    update({ error, failure: '' })
    if (error) return
    reset.mutate(
      { id: subject.id, password: form.password },
      {
        onSuccess: () => {
          toast.success(`Password reset for ${subject.name}`)
          onClose()
        },
        onError: (failure) => update({ failure: errorMessage(failure) }),
      },
    )
  }

  return (
    <Sheet
      testID="reset-password-sheet"
      visible={!!login}
      onClose={onClose}
      title="Reset password"
      subtitle={subject ? `${subject.name} · ${subject.email}` : undefined}
      footer={
        <>
          <FormError testID="reset-password-error" message={form.failure} />
          <Button testID="reset-password-submit" label="Reset password" icon="key" full loading={reset.isPending} onPress={submit} />
        </>
      }
    >
      <Banner tone="amber" icon="alert-triangle" text="They will be signed out on every device and must sign in with the new password. Share it with them privately." />
      <TextField
        testID="reset-password-input"
        label="New password"
        required
        secure
        value={form.password}
        onChangeText={(password) => update({ password })}
        error={form.error}
        hint={PASSWORD_HINT}
        onSubmitEditing={submit}
      />
    </Sheet>
  )
}
