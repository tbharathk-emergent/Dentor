/**
 * What each role may open in the Dentor Clinic app. It mirrors the API's rules
 * (backend/app/roles.py: CLINIC_APP_ROLES, FRONT_DESK_ROLES, CLINICAL_ROLES, FINANCE_ROLES),
 * which are what actually decide; this only keeps the app from offering what the API refuses.
 */
export type Area =
  | 'front-desk' // appointments, patients, drafts, recall, book a consultant, labs, tracking
  | 'clinical' // prescriptions, certificates, case summaries
  | 'money' // accounts, expenses, statements, the clinic's figures in rupees
  | 'admin' // team and logins, clinic profile and rules, offers, jobs, subscription, uploads
  | 'everyone' // chat, tickets, help, notifications, own password

const ADMIN = ['Clinic Owner', 'Administrator']
const CLINICAL = [...ADMIN, 'Dentist', 'Doctor']
const FRONT_DESK = [...CLINICAL, 'Receptionist']
const MONEY = [...ADMIN, 'Accountant']

const AREA_ROLES: Record<Exclude<Area, 'everyone'>, string[]> = {
  'front-desk': FRONT_DESK,
  clinical: CLINICAL,
  money: MONEY,
  admin: ADMIN,
}

export function can(role: string | undefined, area: Area): boolean {
  if (area === 'everyone') return true
  return !!role && AREA_ROLES[area].includes(role)
}
