/**
 * Session storage on iOS and Android: the device Keychain / Keystore (react-native-keychain).
 * Each key is stored as its own keychain "service". The web build uses storage.web.ts.
 */
import { Platform, Settings } from 'react-native'
import * as Keychain from 'react-native-keychain'

// Keychain service names: keep to alphanumerics, ".", "-" and "_".
const service = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_')

const INSTALLED_FLAG = 'dentor.installed'
let cleared: Promise<void> | null = null

/**
 * iOS keeps an app's Keychain items when the app is deleted, so a reinstall (or the phone's
 * next owner installing the app) would open signed in as whoever used it last. App
 * preferences, unlike the Keychain, are removed with the app: when the flag kept there is
 * missing this is the first launch after an install, and everything the app had stored in
 * the Keychain is removed before anything is read. Android clears its storage on uninstall.
 */
function freshInstallCleared(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve()
  cleared ??= (async () => {
    try {
      if (Settings.get(INSTALLED_FLAG)) return
      for (const name of await Keychain.getAllGenericPasswordServices()) {
        await Keychain.resetGenericPassword({ service: name })
      }
      Settings.set({ [INSTALLED_FLAG]: true })
    } catch {
      /* never keep the app from starting over this */
    }
  })()
  return cleared
}

export async function loadItem(key: string): Promise<string | null> {
  await freshInstallCleared()
  try {
    const found = await Keychain.getGenericPassword({ service: service(key) })
    return found ? found.password : null
  } catch {
    return null
  }
}

export async function saveItem(key: string, value: string): Promise<void> {
  await freshInstallCleared()
  try {
    await Keychain.setGenericPassword('dentor', value, { service: service(key) })
  } catch (error) {
    // Keychain unavailable (device locked, or an unsigned simulator build): the user stays
    // signed in for this run only.
    if (__DEV__) console.warn(`Could not save "${key}" to the keychain`, error)
  }
}

export async function removeItem(key: string): Promise<void> {
  await freshInstallCleared()
  try {
    await Keychain.resetGenericPassword({ service: service(key) })
  } catch {
    /* nothing to remove */
  }
}
