/** What this app keeps in its signed-in session (see AppProviders `pick`). */
export interface StaffSession {
  user: {
    id: string
    name: string
    email: string
    role: string
    consultant_id?: string
    clinic?: { id: string; name: string; code: string }
  } | null
}

/** An inclusive pair of local dates (yyyy-mm-dd) sent as `date_from` / `date_to`. */
export interface DateRange {
  from: string
  to: string
}

/* ------------------------------------------------- GET /api/owner/overview */

export interface OverviewDay {
  date: string
  label: string
  collected: number
  appointments: number
}

export interface Overview {
  from: string
  to: string
  today: string
  /** Null for roles that may not see money (`money` is false). */
  billed: number
  collected: number
  /** Balance due across every invoice of the clinic, not only the chosen period. */
  outstanding: number
  invoices: number
  average_invoice: number
  appointments: number
  appointments_by_status: Record<string, number>
  patients_total: number
  patients_new: number
  series: OverviewDay[]
  today_summary: { appointments: number; waiting: number; completed: number; collected: number }
  /** False for roles without access to money: the rupee figures then come as null. */
  money?: boolean
}

/* -------------------------------------------------- GET /api/owner/finance */

export interface AmountBucket {
  name: string
  amount: number
  count: number
}

export interface OutstandingInvoice {
  id: string
  number: string
  date: string
  date_label: string
  patient: string
  doctor: string
  total: number
  balance: number
  status: string
}

export interface RecentPayment {
  id: string
  receipt: string
  date: string
  date_label: string
  patient: string
  mode: string
  amount: number
  invoice: string
}

export interface Finance {
  from: string
  to: string
  billed: number
  collected: number
  by_mode: AmountBucket[]
  by_doctor: AmountBucket[]
  by_treatment: AmountBucket[]
  outstanding_total: number
  outstanding: OutstandingInvoice[]
  recent_payments: RecentPayment[]
}

/* ----------------------------------------------- GET /api/owner/operations */

export interface TodayAppointment {
  id: string
  time: string
  time_label: string
  patient: string
  treatment: string
  doctor: string
  chair: string
  status: string
  /** "Patient App" when the patient booked it themselves. */
  source: string
}

export interface LabOrderAlert {
  id: string
  code: string
  patient: string
  caseType: string
  lab: string
  due: string
  due_label: string
  status: string
  stage: string
}

export interface LowStockItem {
  id: string
  name: string
  code: string
  stock: number
  reorder: number
  out: boolean
}

export interface Operations {
  today: string
  appointments: TodayAppointment[]
  lab: { by_status: Record<string, number>; attention: LabOrderAlert[] }
  pharmacy_low: LowStockItem[]
  inventory_low: LowStockItem[]
  leads: { total: number; by_stage: Record<string, number>; pipeline_value: number }
  reviews: { total: number; pending: number; average: number }
}

/* ----------------------------------------------------- GET /api/owner/team */

export interface DoctorPerformance {
  id: string
  name: string
  code: string
  specialty: string
  type: string
  status: string
  appointments: number
  completed: number
  billed: number
  collected: number
}

export interface StaffMember {
  id: string
  code: string
  name: string
  role: string
  department: string
  mobile: string
  status: string
  employment: string
}

export interface Team {
  from: string
  to: string
  doctors: DoctorPerformance[]
  staff: StaffMember[]
}

/* --------------------------------------------------- GET /api/owner/clinic */

export interface Clinic {
  id: string
  code: string
  name: string
  city: string
  phone: string
  email: string
  address: string
  plan: string
  status: string
}

export interface ClinicProfile {
  clinic: Clinic
}

/** The four fields an owner may change with PATCH /api/owner/clinic. */
export type ClinicContact = Pick<Clinic, 'phone' | 'email' | 'address' | 'city'>

/* ------------------------------------------------------- GET /api/settings */

/** The clinic's settings map. Rules are booleans; the rest are display preferences. */
export type ClinicSettings = Record<string, unknown>

/* --------------------------------------------------- GET /api/clinic/users */

export interface ClinicLogin {
  id: string
  name: string
  email: string
  role: string
  status: string
  consultant_id: string
  consultant_name: string
  created_at: string
}

export interface ClinicLogins {
  items: ClinicLogin[]
  roles: string[]
}

export interface NewLogin {
  name: string
  email: string
  password: string
  role: string
  consultant_id?: string
}

export interface LoginChanges {
  name?: string
  role?: string
  status?: string
  consultant_id?: string
}

/* ---------------------------------------------------- GET /api/consultants */

export interface ConsultantProfile {
  id: string
  code: string
  name: string
  specialty: string
  type: string
  status: string
}
