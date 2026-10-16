/* Shapes of /api/clinic-app/* (backend/app/routers/clinic_app.py). */

export type Scope = 'today' | 'upcoming' | 'past' | 'drafts' | 'cancelled' | 'all'
export type Kind = 'in-house' | 'consultant'

export interface ClinicAppointment {
  id: string
  code: string
  patient: string
  patient_code: string
  date: string
  date_label: string
  time: string
  time_label: string
  treatment: string
  doctor: string
  chair: string
  status: 'Scheduled' | 'Waiting' | 'Completed' | 'Cancelled' | 'Draft'
  kind: Kind
  specialty: string
  source: string
  notes: string
  duration: string
  cancel_reason: string
  refund_note: string
  reschedule_reason: string
  rescheduled_from: null | { date: string; time: string; date_label: string; time_label: string }
  changeable: boolean
}

export interface AppointmentList {
  today: string
  items: ClinicAppointment[]
  counts: { today: number; upcoming: number; drafts: number }
}

export interface AppointmentDetail extends ClinicAppointment {
  patient_record: null | { id: string; code: string; name: string; age: string | number; gender: string; mobile: string; allergy: string; history: string; blood: string }
  treatments: { name: string; tooth: string; status: string; date: string }[]
  prescriptions: { code: string; date: string; diagnosis: string; doctor: string }[]
  visits: { date: string; treatment: string; status: string }[]
  can_change: boolean
}

export interface MonthView {
  month: string
  first: string
  last: string
  today: string
  days: Record<string, number>
}

export interface Doctor {
  id: string
  name: string
  specialty: string
  kind: Kind
}

export interface DaySlot {
  time: string
  available: boolean
}

export interface PatientRow {
  id: string
  code: string
  name: string
  mobile: string
  age: string | number
  gender: string
  last_visit: string
  last_visit_label: string
  treatment: string
  status: string
}

export interface PatientList {
  items: PatientRow[]
  figures: { total: number; new_this_month: number; seen_today: number }
}

export interface NewPatient {
  name: string
  mobile: string
  dob?: string
  gender?: string
  blood?: string
  email?: string
  address?: string
  city?: string
  allergy?: string
  history?: string
  visit_reason?: string
  bp?: string
  glucose?: string
  insurance_company?: string
  insurance_policy?: string
  emergencyName?: string
  emergencyMobile?: string
  allow_duplicate?: boolean
}

export interface PatientDashboard {
  id: string
  profile: Record<string, string | number> & { vitals: { bp?: string; glucose?: string }; insurance: { company?: string; policy?: string } }
  tiles: { appointments: number; clinical_chart: number; reports: number; prescriptions: number; imaging: number; cbct: number }
  appointments: { counts: { upcoming: number; completed: number; cancelled: number }; items: ClinicAppointment[] }
  clinical: {
    treatments: { name: string; tooth: string; status: string; date: string; doctor: string; notes: string }[]
    procedures: { name: string; tooth: string; status: string; date: string; doctor: string }[]
    multi_visit: number
  }
  consents: { title: string; status: string; date: string }[]
  money: boolean
  can_change: boolean
  accounts: null | {
    billed: number
    paid: number
    balance: number
    invoices: { id: string; number: string; date: string; treatment: string; total: number; paid: number; balance: number; status: string }[]
    payments: { receipt: string; date: string; mode: string; amount: number; invoice: string }[]
  }
}
