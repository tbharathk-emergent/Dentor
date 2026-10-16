/** Form checks shared by sign-up, profile and booking forms. Each returns what to fix, or undefined. */

export const PASSWORD_RULE = 'Use at least 8 characters with a letter and a number.'

import { EMAIL_PATTERN } from '@dentor/shared'

/**
 * Mobile numbers are checked and sent the way the API reads them: `mobileProblem` and
 * `normalizeMobile` (shared) drop separators and keep the last ten digits, so a number typed
 * or pasted as "+91 98765 43210" or "09876543210" is 9876543210 here as it is on the server.
 */
export { mobileProblem, normalizeMobile } from '@dentor/shared'

/** Keep only digits, at most `max`: what the number fields store. */
export const onlyDigits = (raw: string, max = 10) => raw.replace(/\D/g, '').slice(0, max)

/** Room for a mobile number written with its country code and separators: "+91 98765-43210". */
export const MOBILE_INPUT_MAX = 16

export function emailProblem(email: string, options: { required?: boolean } = {}): string | undefined {
  const value = email.trim()
  if (!value) return options.required ? 'Enter your email address.' : undefined
  return EMAIL_PATTERN.test(value) ? undefined : 'Enter a valid email address, like name@example.com.'
}

export function passwordProblem(password: string): string | undefined {
  if (!password) return 'Choose a password.'
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return PASSWORD_RULE
  return undefined
}

export function nameProblem(name: string, who = 'your'): string | undefined {
  return name.trim().length < 2 ? `Enter ${who} full name.` : undefined
}

export function ageProblem(age: string, options: { required?: boolean } = {}): string | undefined {
  if (!age) return options.required ? 'Enter the age in years.' : undefined
  const n = Number(age)
  return Number.isInteger(n) && n >= 0 && n <= 120 ? undefined : 'Enter an age between 0 and 120.'
}

/** yyyy-mm-dd, a real calendar day, not in the future. */
export function birthDateProblem(value: string): string | undefined {
  if (!value) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return 'Use the format YYYY-MM-DD, for example 1990-04-23.'
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return 'That date does not exist.'
  if (date.getTime() > Date.now()) return 'A date of birth cannot be in the future.'
  return undefined
}

/** True when the form has no messages left. */
export const isClean = (errors: Record<string, string | undefined>) => Object.values(errors).every((e) => !e)
