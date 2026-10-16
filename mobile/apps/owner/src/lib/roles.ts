/** The role whose login must be linked to a consultant profile. */
export const CONSULTANT_ROLE = 'Consultant'

const ROLE_ACCESS: Record<string, string> = {
  'Clinic Owner': 'Everything in the clinic, this owner app, and control of every login.',
  Administrator: 'Full reception and back-office access, and can manage logins other than owner accounts.',
  [CONSULTANT_ROLE]: 'Signs in to the Dentor Consultant app only: their own schedule, patients and earnings.',
}

/** What a login with this role can reach (the access tiers the API enforces). */
export const roleAccess = (role: string) => ROLE_ACCESS[role] ?? 'Reception and back-office access in the web app.'
