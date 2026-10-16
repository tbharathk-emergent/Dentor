import { Button, Sheet, TextField, errorMessage, useToast } from '@dentor/shared'
import { ConsultantPicker } from '@/components/team/ConsultantPicker'
import { FormError } from '@/components/FormError'
import { RolePicker } from '@/components/team/RolePicker'
import { useConsultantProfiles, useCreateLogin } from '@/hooks/useLogins'
import { useSheetForm } from '@/hooks/useSheetForm'
import { CONSULTANT_ROLE } from '@/lib/roles'
import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH, PASSWORD_HINT } from '@/lib/validation'

interface FieldErrors {
  name?: string
  email?: string
  password?: string
  role?: string
  consultant?: string
}

const DEFAULT_ROLE = 'Receptionist'

/** Creates a login. What needs fixing — and any refusal from the API (email in use, weak password, …) — is shown above the button. */
export function AddLoginSheet({ visible, onClose, roles, takenConsultantIds }: { visible: boolean; onClose: () => void; roles: string[]; takenConsultantIds: string[] }) {
  const toast = useToast()
  const create = useCreateLogin()
  const [form, update] = useSheetForm(visible ? 'new' : null, () => ({
    name: '',
    email: '',
    password: '',
    role: roles.includes(DEFAULT_ROLE) ? DEFAULT_ROLE : '',
    consultantId: '',
    errors: {} as FieldErrors,
    failure: '',
  }))
  const isConsultant = form.role === CONSULTANT_ROLE
  const profiles = useConsultantProfiles(visible && isConsultant)

  const submit = () => {
    const name = form.name.trim()
    const email = form.email.trim().toLowerCase()
    const errors: FieldErrors = {}
    if (name.length < 2) errors.name = "Enter the person's name (at least 2 characters)."
    if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address, for example name@clinic.in.'
    if (form.password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    if (!form.role) errors.role = 'Choose a role for this login.'
    if (isConsultant && !form.consultantId) errors.consultant = 'Choose the consultant profile this login belongs to.'
    // The first problem is repeated beside the button: the field itself may be scrolled out of view.
    update({ errors, failure: Object.values(errors)[0] ?? '' })
    if (Object.keys(errors).length > 0) return

    create.mutate(
      { name, email, password: form.password, role: form.role, ...(isConsultant ? { consultant_id: form.consultantId } : {}) },
      {
        onSuccess: (login) => {
          toast.success(`Login created for ${login.name}`)
          onClose()
        },
        onError: (error) => update({ failure: errorMessage(error) }),
      },
    )
  }

  return (
    <Sheet
      testID="add-login-sheet"
      visible={visible}
      onClose={onClose}
      title="Add login"
      subtitle="They sign in with this email and password."
      footer={
        <>
          <FormError testID="new-login-error" message={form.failure} />
          <Button testID="new-login-submit" label="Create login" icon="user-plus" full loading={create.isPending} onPress={submit} />
        </>
      }
    >
      <TextField testID="new-login-name" label="Name" required value={form.name} onChangeText={(name) => update({ name })} placeholder="Full name" autoCapitalize="words" maxLength={80} error={form.errors.name} />
      <TextField
        testID="new-login-email"
        label="Email"
        required
        value={form.email}
        onChangeText={(email) => update({ email })}
        placeholder="name@clinic.in"
        keyboardType="email-address"
        autoCapitalize="none"
        maxLength={120}
        error={form.errors.email}
      />
      <TextField testID="new-login-password" label="Password" required secure value={form.password} onChangeText={(password) => update({ password })} error={form.errors.password} hint={PASSWORD_HINT} />
      <RolePicker scope="new-login" roles={roles} value={form.role} onChange={(role) => update({ role, consultantId: '' })} error={form.errors.role} />
      {isConsultant && (
        <ConsultantPicker
          scope="new-login"
          profiles={profiles}
          takenIds={takenConsultantIds}
          value={form.consultantId}
          onChange={(consultantId) => update({ consultantId })}
          error={form.errors.consultant}
        />
      )}
    </Sheet>
  )
}
