import { TextField } from '@dentor/shared'
import { MOBILE_INPUT_MAX, onlyDigits } from '@/lib/validate'

/**
 * Indian mobile number. Anything that is not a digit is dropped as it is typed. A country
 * code or a leading zero may be typed or pasted too: the forms read the number as the API
 * does (`normalizeMobile`), from its last ten digits.
 */
export function MobileField({
  value,
  onChange,
  error,
  label = 'Mobile number',
  hint,
  required = true,
  onSubmit,
  testID,
}: {
  value: string
  onChange: (mobile: string) => void
  error?: string
  label?: string
  hint?: string
  required?: boolean
  onSubmit?: () => void
  testID?: string
}) {
  return (
    <TextField
      testID={testID}
      label={label}
      required={required}
      icon="phone"
      value={value}
      onChangeText={(text) => onChange(onlyDigits(text, MOBILE_INPUT_MAX))}
      placeholder="10-digit mobile number"
      keyboardType="phone-pad"
      maxLength={MOBILE_INPUT_MAX}
      error={error}
      hint={hint}
      onSubmitEditing={onSubmit}
    />
  )
}
