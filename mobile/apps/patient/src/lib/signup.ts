import { ageProblem, emailProblem, mobileProblem, nameProblem, passwordProblem } from '@/lib/validate'

/** What the sign-up form collects. */
export interface SignupValues {
  name: string
  mobile: string
  email: string
  gender: string
  age: string
  password: string
  confirm: string
  agreed: boolean
}

export type SignupErrors = Partial<Record<keyof SignupValues, string>>

export const EMPTY_SIGNUP: SignupValues = { name: '', mobile: '', email: '', gender: '', age: '', password: '', confirm: '', agreed: false }

/** What still needs fixing before a verification code can be sent. */
export function signupProblems(values: SignupValues): SignupErrors {
  return {
    name: nameProblem(values.name),
    mobile: mobileProblem(values.mobile),
    email: emailProblem(values.email),
    gender: values.gender ? undefined : 'Choose one.',
    age: ageProblem(values.age, { required: true }),
    password: passwordProblem(values.password),
    confirm: values.confirm === values.password ? undefined : 'The two passwords do not match.',
    agreed: values.agreed ? undefined : 'Please accept the terms and the privacy policy to continue.',
  }
}
