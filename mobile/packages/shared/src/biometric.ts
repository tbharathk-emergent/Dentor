/**
 * Fingerprint / face sign-in on iOS and Android (the browser build uses biometric.web.ts).
 *
 * Nothing biometric is read or stored by the app: the API hands this device a random secret when
 * the person turns fingerprint sign-in on (POST …/device/enroll). The secret is kept in the
 * Keychain / Keystore under a biometry access control, so the operating system releases it only
 * after its own fingerprint or face check, and only while the enrolled fingerprints are unchanged
 * (BIOMETRY_CURRENT_SET). The API stores only a hash of it.
 */
import * as Keychain from 'react-native-keychain'
import { loadItem, removeItem, saveItem } from './storage'

export interface DeviceCredential {
  device_id: string
  secret: string
}

/** What is remembered outside the protected item: who it signs in, for the login screen. */
export interface BiometricInfo {
  device_id: string
  label: string
}

const vault = (scope: string) => `dentor.bio.${scope}`
const meta = (scope: string) => `dentor.bio.${scope}.meta`

/** "Fingerprint", "Face ID", "Touch ID", "Face" or "Iris"; null when the device has none set up. */
export async function biometryName(): Promise<string | null> {
  try {
    const kind = await Keychain.getSupportedBiometryType()
    if (!kind) return null
    if (kind === Keychain.BIOMETRY_TYPE.FACE_ID) return 'Face ID'
    if (kind === Keychain.BIOMETRY_TYPE.TOUCH_ID) return 'Touch ID'
    if (kind === Keychain.BIOMETRY_TYPE.FACE) return 'Face'
    if (kind === Keychain.BIOMETRY_TYPE.IRIS) return 'Iris'
    return 'Fingerprint'
  } catch {
    return null
  }
}

export async function biometricInfo(scope: string): Promise<BiometricInfo | null> {
  try {
    const raw = await loadItem(meta(scope))
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.device_id ? parsed : null
  } catch {
    return null
  }
}

/** Keeps the secret behind the biometric check. Throws when the device cannot protect it. */
export async function saveBiometric(scope: string, credential: DeviceCredential, label: string): Promise<void> {
  const saved = await Keychain.setGenericPassword(credential.device_id, credential.secret, {
    service: vault(scope),
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
    accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
    storage: Keychain.STORAGE_TYPE.AES_GCM,
  })
  if (!saved) throw new Error('This device could not store the key for fingerprint sign-in.')
  await saveItem(meta(scope), JSON.stringify({ device_id: credential.device_id, label }))
}

/**
 * Asks the operating system for the fingerprint or face check and returns the secret.
 * Resolves null when the person cancels; throws when the key is gone (fingerprints changed).
 */
export async function unlockBiometric(scope: string, title: string): Promise<DeviceCredential | null> {
  try {
    const found = await Keychain.getGenericPassword({
      service: vault(scope),
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      authenticationPrompt: { title, cancel: 'Use password' },
    })
    if (!found) throw new Error('gone')
    return { device_id: found.username, secret: found.password }
  } catch (error) {
    const text = String((error as Error)?.message ?? error)
    if (/cancel/i.test(text)) return null
    await forgetBiometric(scope)
    throw new Error('Fingerprint sign-in is no longer set up on this device. Sign in with your password.')
  }
}

export async function forgetBiometric(scope: string): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: vault(scope) })
  } catch {
    /* nothing stored */
  }
  await removeItem(meta(scope))
}
