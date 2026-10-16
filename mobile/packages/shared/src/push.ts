/**
 * Push-notification registration hook point.
 *
 * Delivering push needs a push provider (Firebase Cloud Messaging / APNs) with the clinic
 * platform's own credentials, which are not part of this repository. Until one is wired in,
 * this resolves to `false` and the apps rely on the in-app notification centre, which is
 * fully functional.
 *
 * To enable push: add the provider's SDK to the native projects, obtain the device token in
 * `getDeviceToken`, and the token is then stored through `save` (POST /api/devices or
 * /api/patient/devices). The API forwards notifications to the configured push webhook.
 */
import { Platform } from 'react-native'

type TokenGetter = () => Promise<string | null>

let getDeviceToken: TokenGetter | null = null

/** Called once by an app that has a push provider installed. */
export function setPushTokenProvider(getter: TokenGetter) {
  getDeviceToken = getter
}

export async function registerForPush(save: (token: string, platform: string) => Promise<unknown>): Promise<boolean> {
  if (!getDeviceToken || Platform.OS === 'web') return false
  try {
    const token = await getDeviceToken()
    if (!token) return false
    await save(token, Platform.OS)
    return true
  } catch {
    return false
  }
}
