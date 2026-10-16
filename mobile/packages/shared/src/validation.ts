/**
 * Input checks the apps share. Each one repeats a rule the API applies (the API has the last
 * word and its message is shown when it refuses), so a form says the same thing in every app.
 */

/** An email address as the API and the web app check it: something@something.something, no spaces. */
export const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

/**
 * A mobile number as the API reads it (`normalize_mobile`): separators are dropped and, of
 * what is left, the last ten digits count, so "+91 98765 43210" and "09876543210" are
 * 9876543210. Returns the digits; `mobileProblem` says whether they make a valid number.
 */
export function normalizeMobile(raw?: string | null): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

/** What is wrong with a (normalised) mobile number, or undefined: ten digits starting 6–9, as the API requires. */
export function mobileProblem(mobile: string, options: { required?: boolean } = { required: true }): string | undefined {
  const digits = normalizeMobile(mobile)
  if (!digits) return options.required ? 'Enter your 10-digit mobile number.' : undefined
  if (digits.length !== 10) return 'A mobile number has 10 digits.'
  if (!/^[6-9]/.test(digits)) return 'Indian mobile numbers start with 6, 7, 8 or 9.'
  return undefined
}

/** The strong-password rule the API applies to sign-ups and, by default, to staff resets. */
export const STRONG_PASSWORD_RULE = 'At least 8 characters with upper and lower case letters, a digit and a symbol.'

export function strongPasswordProblem(password: string): string | undefined {
  if (!password) return 'Choose a password.'
  if (password.length < 8) return 'Use at least 8 characters.'
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Use upper and lower case letters, a digit and a symbol.'
  }
  return undefined
}
