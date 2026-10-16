type Age = number | string | null | undefined

const hasAge = (age: Age) => age !== '' && age !== null && age !== undefined

/** "36 years", or '' when the record has no age. */
export const ageInYears = (age: Age) => (hasAge(age) ? `${age} years` : '')

/** "36 y · Male" — skips whatever the record does not have. */
export function ageGender(p: { age?: Age; gender?: string | null }): string {
  const parts: string[] = []
  if (hasAge(p.age)) parts.push(`${p.age} y`)
  if (p.gender) parts.push(p.gender)
  return parts.join(' · ')
}

/** Joins the non-empty parts with a middle dot. */
export const dotJoin = (...parts: (string | number | null | undefined | false)[]) =>
  parts.filter((p) => p !== '' && p !== null && p !== undefined && p !== false).join(' · ')
