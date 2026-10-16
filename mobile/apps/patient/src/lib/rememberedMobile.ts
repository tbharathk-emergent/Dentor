/**
 * The mobile number last typed on a signed-out screen, so moving between log-in, sign-up,
 * code login and password reset never asks for it twice. Kept for this run of the app only.
 */
let lastMobile = ''

export const rememberMobile = (mobile: string) => {
  lastMobile = mobile
}

export const recallMobile = () => lastMobile
