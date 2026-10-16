/**
 * Sign-in extras the three app designs share: "Remember me", fingerprint sign-in on the login
 * screen and the fingerprint switch in Settings (biometric.ts holds the security notes).
 */
import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { api, errorMessage, type Tokens } from '../api'
import { biometricInfo, biometryName, forgetBiometric, saveBiometric, unlockBiometric, type BiometricInfo } from '../biometric'
import { colors, face, space, switchColors } from '../theme'
import { useToast } from './feedback'
import { MaterialDesignIcons } from './icons'
import { Icon } from './primitives'

export function RememberMe({ value, onChange, color = colors.title }: { value: boolean; onChange: (next: boolean) => void; color?: string }) {
  return (
    <Pressable
      testID="login-remember"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel="Remember me"
      hitSlop={8}
      onPress={() => onChange(!value)}
      style={styles.remember}
    >
      <View style={[styles.tick, { borderColor: color }, value && { backgroundColor: color }]}>
        {value && <Icon name="check" size={13} color="#ffffff" />}
      </View>
      <Text style={[styles.rememberText, { color }]}>Remember me</Text>
    </Pressable>
  )
}

/**
 * The login screen's fingerprint button. `loginPath` is the API's device sign-in
 * (staff: /api/auth/device/login, patients: /api/patient/auth/device/login).
 */
export function useBiometricSignIn(scope: string, loginPath: string, extra: Record<string, unknown> = {}) {
  const [info, setInfo] = useState<BiometricInfo | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const extraKey = JSON.stringify(extra)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [found, kind] = await Promise.all([biometricInfo(scope), biometryName()])
      if (alive) {
        setInfo(kind ? found : null)
        setName(kind)
      }
    })()
    return () => {
      alive = false
    }
  }, [scope])

  const signInWith = useCallback(async (): Promise<(Tokens & Record<string, any>) | null> => {
    if (!info || busy) return null
    setBusy(true)
    setError(null)
    try {
      const credential = await unlockBiometric(scope, `Sign in to Dentor as ${info.label}`)
      if (!credential) return null
      try {
        return await api.public.post('/' + loginPath.replace(/^\//, ''), { ...credential, ...JSON.parse(extraKey), device: Platform.OS })
      } catch (err) {
        // The server ended it (password changed, turned off elsewhere): forget it here too.
        if ((err as any)?.status === 401) {
          await forgetBiometric(scope)
          setInfo(null)
        }
        throw err
      }
    } catch (err) {
      setError(errorMessage(err, 'Fingerprint sign-in did not work. Sign in with your password.'))
      setInfo(await biometricInfo(scope))
      return null
    } finally {
      setBusy(false)
    }
  }, [info, busy, scope, loginPath, extraKey])

  return { available: !!info, info, name, busy, error, signInWith }
}

export function BiometricButton({ name, label, busy, onPress, color = colors.header }: { name: string | null; label?: string; busy?: boolean; onPress: () => void; color?: string }) {
  const face = name === 'Face ID' || name === 'Face'
  return (
    <Pressable
      testID="login-biometric"
      accessibilityRole="button"
      accessibilityLabel={`Login with ${name ?? 'fingerprint'}${label ? ` as ${label}` : ''}`}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.bio, (pressed || busy) && { opacity: 0.7 }]}
    >
      <MaterialDesignIcons name={face ? 'face-recognition' : 'fingerprint'} size={40} color={color} />
      <Text style={[styles.bioText, { color }]}>{busy ? 'Checking…' : `Login with ${name ?? 'Fingerprint'}`}</Text>
      {!!label && <Text style={styles.bioWho}>{label}</Text>}
    </Pressable>
  )
}

/**
 * Settings: "Fingerprint" on or off. Turning it on asks the API for this device's secret, keeps it
 * behind the biometric check and confirms with one fingerprint; turning it off revokes it.
 */
export function BiometricSetting({ scope, enrollPath, revokePath, label }: {
  scope: string
  enrollPath: string
  revokePath: string
  /** Who it signs in, shown on the login screen (an email or a name). */
  label: string
}) {
  const toast = useToast()
  const [name, setName] = useState<string | null>(null)
  const [on, setOn] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [kind, info] = await Promise.all([biometryName(), biometricInfo(scope)])
      if (!alive) return
      setName(kind)
      setOn(!!info)
      setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [scope])

  const toggle = async (next: boolean) => {
    if (busy) return
    setBusy(true)
    try {
      if (next) {
        const credential = await api.post<{ device_id: string; secret: string }>(enrollPath, { device_name: `${Platform.OS} app` })
        try {
          await saveBiometric(scope, credential, label)
          const check = await unlockBiometric(scope, `Confirm ${name ?? 'fingerprint'} sign-in`)
          if (!check) throw new Error('cancelled')
        } catch (err) {
          await api.post(revokePath, { device_id: credential.device_id }).catch(() => {})
          await forgetBiometric(scope)
          throw err
        }
        setOn(true)
        toast.success(`${name ?? 'Fingerprint'} sign-in is on for this device.`)
      } else {
        const info = await biometricInfo(scope)
        if (info) await api.post(revokePath, { device_id: info.device_id }).catch(() => {})
        await forgetBiometric(scope)
        setOn(false)
        toast.success(`${name ?? 'Fingerprint'} sign-in is off.`)
      }
    } catch (err) {
      const text = String((err as Error)?.message ?? '')
      if (text === 'cancelled') toast.info('Not turned on: the fingerprint check was cancelled.')
      else toast.error(err, 'Could not change fingerprint sign-in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // The row keeps its place while the device is asked (no jump of what is below it).
  return (
    <View testID="setting-biometric" style={styles.setting}>
      <View style={[styles.settingIcon, { backgroundColor: colors.header }]}>
        <MaterialDesignIcons name="fingerprint" size={22} color="#ffffff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingTitle}>{name ?? 'Fingerprint'} sign-in</Text>
        <Text style={styles.settingHint}>
          {!ready ? 'Checking this device…' : name ? 'Your fingerprint never leaves this device.' : Platform.OS === 'web' ? 'Available in the phone app.' : 'Set up a fingerprint or face in the device settings first.'}
        </Text>
      </View>
      <Switch
        testID="biometric-switch"
        accessibilityLabel={`${name ?? 'Fingerprint'} sign-in`}
        value={on}
        disabled={!ready || !name || busy}
        onValueChange={toggle}
        {...switchColors()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  remember: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start' },
  tick: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rememberText: { ...face('regular'), fontSize: 14, lineHeight: 20 },
  bio: { alignSelf: 'center', alignItems: 'center', gap: 2, paddingVertical: space.sm, paddingHorizontal: space.lg },
  bioText: { ...face('semibold'), fontSize: 14, lineHeight: 20 },
  bioWho: { ...face('regular'), fontSize: 12, lineHeight: 16, color: colors.textMuted },
  setting: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  settingIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  settingTitle: { ...face('semibold'), fontSize: 16, lineHeight: 22, color: colors.textStrong },
  settingHint: { ...face('regular'), fontSize: 12, lineHeight: 16, color: colors.textMuted },
})
