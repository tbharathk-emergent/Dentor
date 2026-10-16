/** The browser build has no fingerprint sign-in: browsers do not offer the device keychain. */
export interface DeviceCredential {
  device_id: string
  secret: string
}

export interface BiometricInfo {
  device_id: string
  label: string
}

export async function biometryName(): Promise<string | null> {
  return null
}

export async function biometricInfo(_scope: string): Promise<BiometricInfo | null> {
  return null
}

export async function saveBiometric(_scope: string, _credential: DeviceCredential, _label: string): Promise<void> {
  throw new Error('Fingerprint sign-in is only available in the phone app.')
}

export async function unlockBiometric(_scope: string, _title: string): Promise<DeviceCredential | null> {
  return null
}

export async function forgetBiometric(_scope: string): Promise<void> {}
