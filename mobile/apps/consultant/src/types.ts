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

/* ------------------------------------------------------------ API shapes */
/* Mirrors docs/MOBILE_API.md, "Consultant app". Optional fields are the ones the front
   desk may leave empty when it creates a record. */

export type AppointmentStatus = 'Scheduled' | 'Waiting' | 'Completed' | 'Cancelled'

export interface Appointment {
  id: string
  code?: string
  patientCode?: string
  patient: string
  date: string
  time: string
  treatment?: string
  doctor: string
  chair?: string
  duration?: string
  status: AppointmentStatus | string
  notes?: string
  date_label: string
  time_label: string
}

export interface PatientSummary {
  id: string
  code: string
  name: string
  age: number | string
  gender: string
  mobile: string
  blood: string
  allergy: string
  history: string
  risk: string
  treatment: string
  status: string
  lastVisit: string
  photo: string
}

export interface AppointmentDetail extends Appointment {
  patient_record: PatientSummary | null
}

export interface ConsultantProfile {
  id: string
  code: string
  name: string
  specialty: string
  type: string
  credentials: string
  experience: number | string
  availability: string
  location: string
  fee: number
  rating: number
  about: string
  phone: string
  email: string
  login_name: string
}

export interface ProfileResponse {
  profile: ConsultantProfile
  clinic: { name: string; phone: string; address: string }
}

export type ProfileChanges = Partial<Pick<ConsultantProfile, 'availability' | 'location' | 'about' | 'phone'>>

export interface Dashboard {
  date: string
  date_label: string
  profile: ConsultantProfile
  total: number
  by_status: Record<AppointmentStatus, number>
  next: Appointment | null
  today: Appointment[]
  upcoming: Appointment[]
  patients: number
}

/** A treatment-plan entry or a performed procedure (same shape). */
export interface ClinicalRecord {
  id: string
  patientId: string
  name: string
  tooth?: string
  doctor?: string
  date?: string
  status?: string
  cost?: number
  notes?: string
}

export interface Medicine {
  drug: string
  dose: string
  freq: string
  days: string
  unit: string
  instruction: string
}

export interface Prescription {
  id: string
  code: string
  patient: string
  patientCode: string
  age?: number | string
  gender?: string
  allergy?: string
  date: string
  doctor: string
  complaint?: string
  diagnosis: string
  note?: string
  meds: Medicine[]
  advice?: string
  followUp?: string
  status?: string
}

export interface Consent {
  id: string
  title: string
  date?: string
  status: string
  notes?: string
}

export interface PatientFile {
  id: string
  name: string
  category: string
  size: number
  created_at: string
}

export interface PatientFileContent extends PatientFile {
  dataUrl?: string
}

export interface ToothState {
  condition: string
  note?: string
}

export interface PatientDetail {
  patient: PatientSummary
  appointments: Appointment[]
  treatments: ClinicalRecord[]
  procedures: ClinicalRecord[]
  prescriptions: Prescription[]
  consents: Consent[]
  files: PatientFile[]
  /** FDI tooth number → state. Teeth that are not listed are healthy. */
  teeth: Record<string, ToothState>
}

export interface CatalogMedicine {
  name: string
  form: string
  in_stock: boolean
}

export interface CatalogTreatment {
  name: string
  category: string
  price: number
  duration: number
}

export interface Catalog {
  medicines: CatalogMedicine[]
  treatments: CatalogTreatment[]
}

export interface EarningsInvoice {
  id: string
  number: string
  date: string
  date_label: string
  patient: string
  treatment: string
  total: number
  paid: number
  balance: number
  status: string
}

export interface Earnings {
  from: string
  to: string
  billed: number
  collected: number
  outstanding: number
  invoices: number
  completed_visits: number
  by_treatment: { treatment: string; amount: number }[]
  items: EarningsInvoice[]
}

/** A referral booking made for this consultant through "Book a Consultant". */
export interface Booking {
  id: string
  code?: string
  patient: string
  patientCode?: string
  date: string
  time: string
  reason?: string
  notes?: string
  status?: string
  fee?: number
  location?: string
  date_label: string
  time_label: string
}
