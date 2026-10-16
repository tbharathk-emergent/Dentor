import { loadItem, removeItem, saveItem } from '@dentor/shared'

const ONBOARDED_KEY = 'dentor.patient.onboarded'
const SIGNUP_DETAILS_KEY = 'dentor.patient.signupDetails'

export const hasSeenOnboarding = async () => (await loadItem(ONBOARDED_KEY)) === '1'
export const markOnboardingSeen = () => saveItem(ONBOARDED_KEY, '1')

/**
 * Age and gender typed at sign-up. The sign-in response does not carry them, so they are
 * kept on the device until the clinic chooser has used them to prefill the patient details.
 */
export interface SignupDetails {
  mobile: string
  age: string
  gender: string
}

export const rememberSignupDetails = (details: SignupDetails) => saveItem(SIGNUP_DETAILS_KEY, JSON.stringify(details))

export async function recallSignupDetails(mobile: string): Promise<SignupDetails | null> {
  try {
    const saved = JSON.parse((await loadItem(SIGNUP_DETAILS_KEY)) ?? 'null') as SignupDetails | null
    return saved && saved.mobile === mobile ? saved : null
  } catch {
    return null
  }
}

export const forgetSignupDetails = () => removeItem(SIGNUP_DETAILS_KEY)
