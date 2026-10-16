/** One clinic record this account can act as (same mobile number). */
export interface Profile {
  patient_id: string
  clinic_id: string
  name: string
  code: string
  age?: number | string
  gender?: string
  photo?: string
  clinic_name: string
  clinic_city?: string
}

export interface Account {
  id: string
  name: string
  mobile: string
  email?: string
}

/** What the patient app keeps in its signed-in session (see AppProviders `pick`). */
export interface PatientSession {
  account: Account | null
  /** The active profile; null until the account has joined a clinic. */
  profile: Profile | null
  profiles: Profile[]
}

/** Every sign-in, sign-up, join and profile-switch call answers with this. */
export interface AuthPayload {
  access_token: string
  refresh_token: string
  account: Account
  profiles: Profile[]
  profile: Profile | null
}

export type OtpPurpose = 'signup' | 'login' | 'reset'

export interface OtpRequestResult {
  sent: boolean
  expires_in: number
  resend_in: number
  /** Present only on development servers without an SMS gateway. */
  dev_otp?: string
}

export interface Clinic {
  id: string
  name: string
  code: string
  phone: string
  email: string
  address: string
  city: string
  online_booking: boolean
}

export interface ClinicListing {
  id: string
  name: string
  city: string
  code: string
  address: string
}

/** The patient record at the active clinic. */
export interface PatientProfile {
  id: string
  code: string
  mobile: string
  status: string
  doctor: string
  treatment: string
  lastVisit: string
  relation: string
  name: string
  email: string
  address: string
  city: string
  age: number | string
  gender: string
  blood: string
  dob: string
  emergencyName: string
  emergencyMobile: string
  photo: string
  allergy: string
  history: string
}

/** Fields `PATCH /me` accepts. */
export type ProfileChanges = Partial<
  Pick<
    PatientProfile,
    'name' | 'email' | 'address' | 'city' | 'gender' | 'blood' | 'dob' | 'emergencyName' | 'emergencyMobile' | 'photo' | 'allergy' | 'history'
  >
> & { age?: number }

export interface MeData {
  account: Account
  profile: PatientProfile
  clinic: Clinic
  profiles: Profile[]
}

export interface Appointment {
  id: string
  code: string
  date: string
  time: string
  treatment: string
  doctor: string
  chair: string
  duration: string
  status: string
  notes: string
  date_label: string
  time_label: string
  can_cancel: boolean
  can_reschedule: boolean
  upcoming: boolean
  cancelReason?: string
  /** "Case summary" of a visit that has happened (patient-app.fig 76:2621). */
  case?: {
    diagnosis: string
    procedure: string
    medicines: string[]
    advice: string
    vitals: { bp?: string; glucose?: string }
    files: { id: string; name: string; category: string }[]
    notes: string
  }
}

export type AppointmentScope = 'upcoming' | 'past'

export interface HomeBanner {
  title: string
  subtitle: string
  image: string
}

export interface HomeData {
  profile: PatientProfile
  clinic: Clinic
  next_appointment: Appointment | null
  upcoming_count: number
  outstanding: number
  unread_notifications: number
  unread_chat: number
  pending_consents: number
  prescriptions: number
  banner: HomeBanner | null
}

export interface Doctor {
  id: string
  name: string
  specialty: string
  type: string
  credentials: string
  experience: number | string
  availability: string
  fee: number
  rating: number
}

export interface Slot {
  time: string
  label: string
  available: boolean
}

export interface BookingRequest {
  date: string
  time: string
  doctor: string
  reason?: string
  notes?: string
  /** Booked from a clinic offer: the clinic sees it counted on the offer. */
  offer_id?: string
}

/** A treatment or a procedure on the patient's record. */
export interface ClinicalItem {
  id: string
  name: string
  tooth: string
  doctor: string
  date: string
  status: string
  cost: number
  notes: string
}

export interface ToothState {
  condition: string
  note?: string
}

export interface LabOrder {
  id: string
  code: string
  caseType: string
  teeth: string
  stage: string
  status: string
  due: string
}

export interface RecordsData {
  treatments: ClinicalItem[]
  procedures: ClinicalItem[]
  /** FDI tooth number → what the dentist charted for it. */
  teeth: Record<string, ToothState>
  lab_orders: LabOrder[]
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
  age: number | string
  gender: string
  allergy: string
  date: string
  doctor: string
  complaint: string
  diagnosis: string
  note: string
  meds: Medicine[]
  advice: string
  followUp: string
  status: string
  clinic?: Clinic
}

export interface ReportFile {
  id: string
  name: string
  category: string
  size: number
  created_at: string
  mime: string
  is_image: boolean
  mine: boolean
}

/** `GET /reports/{id}` — the stored file with its content. */
export interface ReportContent {
  id: string
  name: string
  category: string
  size: number
  created_at: string
  dataUrl: string
}

export interface Consent {
  id: string
  title: string
  date: string
  status: string
  notes: string
  signedAt?: string
}

export interface InvoiceLine {
  name: string
  qty: number
  price: number
  tax: number
}

export interface Payment {
  id: string
  receipt: string
  invoice: string
  amount: number
  mode: string
  reference: string
  date: string
}

export interface Invoice {
  id: string
  number: string
  date: string
  treatment: string
  doctor: string
  items: InvoiceLine[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  balance: number
  status: string
  notes: string
  payments?: Payment[]
  clinic?: Clinic
}

export interface InvoicesData {
  items: Invoice[]
  payments: Payment[]
  summary: { billed: number; paid: number; outstanding: number }
}

export interface ChatMessage {
  mine: boolean
  text: string
  /** Clinic-local time label, e.g. "10:32 AM". */
  time: string
  /** ISO timestamp. */
  at: string
  /** Set on a message that is still being sent. */
  pending?: boolean
}

export interface ChatData {
  messages: ChatMessage[]
  clinic: Clinic
  status: string
}

export interface Review {
  id: string
  code: string
  type: string
  subject: string
  rating: number
  status: string
  date: string
  text: string
  visit: string
  response: string
  tags?: string[]
  recommend?: boolean | null
}

export interface ReviewRequest {
  /** "clinic" or a doctor's name. */
  subject: string
  rating: number
  text: string
  visit?: string
  tags?: string[]
  recommend?: boolean
}

export interface FamilyMemberRequest {
  name: string
  age?: number
  gender?: string
  relation?: string
}
