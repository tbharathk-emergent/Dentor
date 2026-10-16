import type { AuthPayload, PatientSession, Profile } from '@/types'

/** Where the signed-in session is kept on the device. */
export const SESSION_KEY = 'dentor.patient.session'

/**
 * Profile photos are data URLs that can run to megabytes. They are loaded from the API where
 * they are shown and never kept with the session, which lives in the device keychain.
 */
const withoutPhoto = <P extends Profile | null>(profile: P): P => (profile ? { ...profile, photo: '' } : profile)

/** Extracts what the patient app keeps from a sign-in, profile-switch or token-refresh response. */
export function pickSession(payload: Partial<AuthPayload>, previous: PatientSession | null): PatientSession {
  const profiles = payload.profiles ?? previous?.profiles ?? []
  return {
    account: payload.account ?? previous?.account ?? null,
    profile: withoutPhoto(payload.profile ?? null),
    profiles: profiles.map(withoutPhoto),
  }
}
