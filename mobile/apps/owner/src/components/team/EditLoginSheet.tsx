import { Banner, Button, ConfirmSheet, Segmented, Sheet, T, TextField, colors, errorMessage, useToast } from '@dentor/shared'
import { View } from 'react-native'
import { ConsultantPicker } from '@/components/team/ConsultantPicker'
import { FormError } from '@/components/FormError'
import { RolePicker } from '@/components/team/RolePicker'
import { useConsultantProfiles, useUpdateLogin } from '@/hooks/useLogins'
import { useLastValue, useSheetForm } from '@/hooks/useSheetForm'
import { CONSULTANT_ROLE } from '@/lib/roles'
import type { ClinicLogin, LoginChanges } from '@/types'

type Status = 'Active' | 'Inactive'

const STATUS_OPTIONS: { key: Status; label: string }[] = [
  { key: 'Active', label: 'Active' },
  { key: 'Inactive', label: 'Inactive' },
]

/**
 * Edits a login's name, role and status. Deactivating asks first, because it signs the person
 * out everywhere. On the owner's own login only the name can change — the API refuses the rest.
 */
export function EditLoginSheet({
  login,
  isSelf,
  roles,
  takenConsultantIds,
  onClose,
  onSaved,
}: {
  login: ClinicLogin | null
  isSelf: boolean
  roles: string[]
  takenConsultantIds: string[]
  onClose: () => void
  onSaved: (login: ClinicLogin) => void
}) {
  const toast = useToast()
  const save = useUpdateLogin()
  const subject = useLastValue(login)
  const [form, update] = useSheetForm(login?.id ?? null, () => ({
    name: login?.name ?? '',
    role: login?.role ?? '',
    status: (login?.status === 'Inactive' ? 'Inactive' : 'Active') as Status,
    consultantId: login?.consultant_id ?? '',
    nameError: '',
    consultantError: '',
    failure: '',
    confirming: false,
  }))
  const isConsultant = form.role === CONSULTANT_ROLE
  const profiles = useConsultantProfiles(!!login && isConsultant && !isSelf)

  const changes: LoginChanges = {}
  if (subject) {
    if (form.name.trim() !== subject.name) changes.name = form.name.trim()
    if (!isSelf) {
      if (form.role !== subject.role) changes.role = form.role
      if (form.status !== subject.status) changes.status = form.status
      if (isConsultant && (changes.role || form.consultantId !== subject.consultant_id)) changes.consultant_id = form.consultantId
    }
  }
  const dirty = Object.keys(changes).length > 0

  const send = () => {
    if (!subject) return
    save.mutate(
      { id: subject.id, changes },
      {
        onSuccess: (saved) => {
          toast.success(changes.status === 'Inactive' ? `${saved.name} can no longer sign in` : `Login updated for ${saved.name}`)
          onSaved(saved)
          onClose()
        },
        onError: (error) => update({ failure: errorMessage(error), confirming: false }),
      },
    )
  }

  const submit = () => {
    const nameError = form.name.trim().length < 2 ? "Enter the person's name (at least 2 characters)." : ''
    const consultantError = isConsultant && !isSelf && !form.consultantId ? 'Choose the consultant profile this login belongs to.' : ''
    // Repeated beside the button: the field itself may be scrolled out of view.
    update({ nameError, consultantError, failure: nameError || consultantError })
    if (nameError || consultantError) return
    if (changes.status === 'Inactive') update({ confirming: true })
    else send()
  }

  return (
    <Sheet
      testID="edit-login-sheet"
      visible={!!login}
      onClose={onClose}
      title="Edit login"
      subtitle={subject?.email}
      footer={
        <>
          <FormError testID="edit-login-error" message={form.failure} />
          <Button testID="edit-login-submit" label="Save changes" full disabled={!dirty} loading={save.isPending && !form.confirming} onPress={submit} />
        </>
      }
    >
      <TextField testID="edit-login-name" label="Name" required value={form.name} onChangeText={(name) => update({ name })} autoCapitalize="words" maxLength={80} error={form.nameError} />
      {isSelf ? (
        <View testID="edit-login-self-note">
          <Banner tone="blue" icon="info" text={`This is your own login (${subject?.role ?? 'Clinic Owner'}). You cannot change its role or deactivate it.`} />
        </View>
      ) : (
        <>
          <RolePicker scope="edit-login" roles={roles} value={form.role} onChange={(role) => update({ role, consultantError: '' })} />
          {isConsultant && (
            <ConsultantPicker
              scope="edit-login"
              profiles={profiles}
              takenIds={takenConsultantIds.filter((id) => id !== subject?.consultant_id)}
              value={form.consultantId}
              onChange={(consultantId) => update({ consultantId, consultantError: '' })}
              error={form.consultantError}
            />
          )}
          <View style={{ gap: 6 }}>
            <T variant="smallStrong">Status</T>
            <Segmented options={STATUS_OPTIONS} value={form.status} onChange={(status) => update({ status })} />
            <T variant="small" color={colors.textMuted} testID="edit-login-status-note">
              {form.status === 'Active' ? 'Can sign in.' : 'Cannot sign in. Saving signs this person out on every device.'}
            </T>
          </View>
        </>
      )}
      <ConfirmSheet
        visible={form.confirming}
        onClose={() => update({ confirming: false })}
        onConfirm={send}
        title="Deactivate this login?"
        message={`${subject?.name ?? 'This person'} will be signed out on every device and cannot sign in again until you set the login back to Active.`}
        confirmLabel="Deactivate login"
        danger
        loading={save.isPending}
      />
    </Sheet>
  )
}
