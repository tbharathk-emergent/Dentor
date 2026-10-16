import type { ConsultantProfile, ProfileChanges } from '@/types'

export type ProfileDraft = Required<ProfileChanges>
export type ProfileErrors = Partial<Record<keyof ProfileDraft, string>>

/** Limits enforced by the API (PATCH /api/consultant/me). */
export const PROFILE_LIMITS: Record<keyof ProfileDraft, number> = { availability: 120, location: 80, about: 600, phone: 20 }

export const draftOf = (p: ConsultantProfile): ProfileDraft => ({
  availability: p.availability ?? '',
  location: p.location ?? '',
  about: p.about ?? '',
  phone: p.phone ?? '',
})

export function validateProfile(draft: ProfileDraft): ProfileErrors {
  const errors: ProfileErrors = {}
  const phone = draft.phone.trim()
  if (phone && (!/^\+?[\d\s-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7)) {
    errors.phone = 'Enter a phone number with at least 7 digits. Only digits, spaces, “-” and a leading “+” are allowed.'
  }
  return errors
}

/** Only the fields that differ from what is saved. */
export function changesOf(draft: ProfileDraft, saved: ConsultantProfile): ProfileChanges {
  const before = draftOf(saved)
  const changes: ProfileChanges = {}
  for (const key of Object.keys(draft) as (keyof ProfileDraft)[]) {
    if (draft[key].trim() !== before[key]) changes[key] = draft[key].trim()
  }
  return changes
}
