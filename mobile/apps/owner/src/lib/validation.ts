export { EMAIL_PATTERN } from '@dentor/shared'

/** The API's minimum; whether a password must also be "strong" is the clinic's rule, so the API decides that. */
export const MIN_PASSWORD_LENGTH = 8
export const PASSWORD_HINT = 'At least 8 characters. While the strong-password rule is on: upper and lower case letters, a digit and a symbol.'

/** What is wrong with a phone number, or '' when it is fine. An empty value is allowed. */
export function phoneProblem(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').length
  if (!/^[+\d\s()-]+$/.test(value) || digits < 7 || digits > 15) {
    return 'Enter a phone number with 7 to 15 digits. You may use +, spaces and hyphens.'
  }
  return ''
}
