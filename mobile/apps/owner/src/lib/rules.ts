import type { ClinicSettings } from '@/types'

export type RuleKey =
  | 'onlineBooking'
  | 'doubleBooking'
  | 'partialPayments'
  | 'roundOff'
  | 'consentRequired'
  | 'financialLock'
  | 'sessionTimeout'
  | 'strongPassword'

export interface ClinicRule {
  key: RuleKey
  /** The switch's name in the reception app's Settings page: one rule, one name in both apps. */
  title: string
  /** What the API does while the rule is on (backend/app/rules.py and the routers that read it). */
  description: string
  /** What the API assumes when the clinic has never saved this rule. */
  fallback: boolean
}

/** The settings the API enforces as clinic rules, in the order they are shown: booking, payments, consent, security. */
export const CLINIC_RULES: ClinicRule[] = [
  { key: 'onlineBooking', title: 'Patient app booking', description: 'Patients can register with this clinic and book or reschedule visits in the Dentor patient app. Cancelling a visit there stays possible when this is off.', fallback: false },
  { key: 'doubleBooking', title: 'Allow double booking', description: 'Allow two appointments for the same doctor or the same chair at one time.', fallback: false },
  { key: 'partialPayments', title: 'Partial payments', description: 'Accept a payment of less than the invoice balance.', fallback: true },
  { key: 'roundOff', title: 'Round off totals', description: 'Round invoice amounts to the nearest rupee.', fallback: true },
  { key: 'consentRequired', title: 'Consent required before procedures', description: 'A signed consent is needed before a treatment or procedure record can be added.', fallback: false },
  { key: 'financialLock', title: 'Financial lock', description: 'Hide revenue on the reception dashboard until a password is entered.', fallback: false },
  { key: 'sessionTimeout', title: 'Session timeout', description: 'A sign-in to the reception app ends after 30 minutes. The Owner and Consultant apps renew their session and stay signed in.', fallback: false },
  { key: 'strongPassword', title: 'Strong password policy', description: 'Staff passwords need upper and lower case letters, a digit and a symbol, as well as 8 characters.', fallback: true },
]

export function isRuleOn(settings: ClinicSettings, rule: ClinicRule): boolean {
  const value = settings[rule.key]
  return value === undefined || value === null ? rule.fallback : Boolean(value)
}
