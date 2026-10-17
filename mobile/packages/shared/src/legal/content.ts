/**
 * The Dentor apps' legal texts: one source for the in-app screens (Patient, Clinic Owner and Consultant apps) and
 * the public pages Google Play and the App Store link to (scripts/legal-pages.mjs writes frontend/public/legal/*.html;
 * `npm test` fails when they are out of date).
 *
 * DRAFTS written from what the apps actually do, for review by a lawyer before publishing. Fill in the details
 * in LEGAL_DETAILS, then set DRAFT_NOTICE to '' once the texts are approved: the in-app banner and the
 * pages' draft line disappear. Plain data only (the page script imports this file with Node's type stripping).
 */

export interface LegalDocument {
  title: string
  /** Shown above the text while it is a draft; empty once approved. */
  notice: string
  /** The date shown as "Last updated". */
  updated: string
  sections: { heading: string; paragraphs: string[] }[]
}

/** Details only Dentor can give. A blank shows as a visible "[to be added]" marker. */
export const LEGAL_DETAILS = {
  company: 'IQDS DENTAL INDIA Pvt. Ltd.',
  product: 'Dentor',
  contactEmail: '',
  postalAddress: '',
  grievanceOfficer: '',
  grievanceEmail: '',
  updated: '16 October 2026',
}

const blank = (value: string, what: string) => value || `[${what}: to be added]`
const COMPANY = LEGAL_DETAILS.company
const CONTACT = blank(LEGAL_DETAILS.contactEmail, 'contact email')
const ADDRESS = blank(LEGAL_DETAILS.postalAddress, 'postal address')
const GRIEVANCE = `${blank(LEGAL_DETAILS.grievanceOfficer, 'Grievance Officer name')}, ${blank(LEGAL_DETAILS.grievanceEmail, 'Grievance Officer email')}`

export const DRAFT_NOTICE = 'Draft for review: this text describes how the app works today and has not yet been approved by Dentor’s legal adviser.'

/** Public addresses of the pages (reception web app's domain). */
export const LEGAL_PAGES = {
  base: 'https://dentor.localappstore.in/legal',
  patientPrivacy: 'privacy-patient.html',
  patientTerms: 'terms-patient.html',
  staffPrivacy: 'privacy-staff.html',
  staffTerms: 'terms-staff.html',
  deletion: 'delete-account.html',
}

const contactSection = {
  heading: 'Contact and grievances',
  paragraphs: [
    `Dentor is provided by ${COMPANY}, ${ADDRESS}. Questions about this policy or your information: ${CONTACT}.`,
    `Grievance Officer: ${GRIEVANCE}. We acknowledge a complaint within 48 hours and aim to resolve it within 30 days.`,
  ],
}

const deletionSection = (where: string) => ({
  heading: 'Deleting your account',
  paragraphs: [
    `${where}, then confirm with your password. Your login stops working at once and you are logged out on every device.`,
    'The deleted login is kept, hidden, so that Dentor support can restore it if you ask. To have it removed permanently, or to delete an account without the app, write to the contact address below; we confirm it is you before acting.',
    'Records a clinic keeps about treatment (patient records, prescriptions, consent forms, bills) are not deleted with a login: clinics must keep them under the law that applies to them.',
  ],
})

export const PATIENT_PRIVACY: LegalDocument = {
  title: 'Privacy Policy',
  notice: DRAFT_NOTICE,
  updated: LEGAL_DETAILS.updated,
  sections: [
    {
      heading: 'Who we are',
      paragraphs: [
        `The Dentor patient app is provided by ${COMPANY} ("Dentor", "we"). It connects you with the dental clinics that use Dentor. The clinic you register with decides how it uses your health information for your care; Dentor runs the service for the clinic.`,
      ],
    },
    {
      heading: 'What we collect',
      paragraphs: [
        'Account: your name, mobile number, password (stored only in scrambled form), and, if you give them, your email, age and gender.',
        'Profile and family: details you add for yourself or for family members registered under your number, such as date of birth, address, blood group, allergies, medical history, emergency contact and photo.',
        'Care: appointments, treatment records, dental chart, prescriptions, reports and files you upload, consent forms, bills, reviews and your chat messages with the clinic.',
        'Device: a session that keeps you logged in and, if you allow notifications, a notification token for this device.',
      ],
    },
    {
      heading: 'How we use it',
      paragraphs: [
        'To let you book and manage visits, see your records, sign consent forms and talk to your clinic; to send verification codes, reminders and updates; and to keep the service secure.',
        'We do not sell your information, show you advertising based on it, or use it for anything unrelated to your dental care.',
      ],
    },
    {
      heading: 'Who sees it',
      paragraphs: [
        'The staff of the clinic you register with, and a consultant the clinic involves in your treatment. Clinics cannot see each other’s records.',
        'Service providers that help us run Dentor, only for that purpose: the server host, the SMS provider that delivers verification codes, the email service, and the notification services of Google and Apple. We may also disclose information when the law requires it.',
      ],
    },
    {
      heading: 'Permissions on your phone',
      paragraphs: [
        'Photos and files: only when you choose something to upload. Notifications: only if you allow them. Fingerprint or face sign-in uses your phone’s own check; no fingerprint or face data reaches Dentor.',
        'Location, camera, calendar and microphone are not used by this version of the app.',
      ],
    },
    {
      heading: 'Security and storage',
      paragraphs: [
        'Information is sent over encrypted connections and kept on servers we control, with access limited to the people who need it. Your clinic’s records are kept for as long as the clinic is required to keep them.',
      ],
    },
    {
      heading: 'Your choices and rights',
      paragraphs: [
        'You can see and correct your profile in the app, ask your clinic to correct a record, withdraw consent for notifications in your phone’s settings, and ask us for a copy of your information or for its erasure, subject to what the clinic must keep by law.',
        'If you add a child or another family member, you confirm that you are their parent, guardian or have their permission.',
      ],
    },
    deletionSection('In the Dentor app, open Profile › Delete account'),
    { heading: 'Changes to this policy', paragraphs: ['We will show a notice in the app before a significant change takes effect. The date at the top shows the current version.'] },
    contactSection,
  ],
}

export const PATIENT_TERMS: LegalDocument = {
  title: 'Terms of Use',
  notice: DRAFT_NOTICE,
  updated: LEGAL_DETAILS.updated,
  sections: [
    {
      heading: 'The service',
      paragraphs: [
        `The Dentor patient app, provided by ${COMPANY}, lets you register with participating dental clinics, book and manage visits, see your records and bills, sign consent forms and message the clinic. By using the app you accept these terms and the Privacy Policy.`,
      ],
    },
    {
      heading: 'Your account',
      paragraphs: [
        'Your account is tied to your mobile number. Give correct details, keep your password to yourself, and tell the clinic or Dentor if you think someone else has used your account. You are responsible for family members you register under your number.',
      ],
    },
    {
      heading: 'Appointments',
      paragraphs: [
        'A booking reserves the time shown, subject to the clinic’s confirmation; the clinic may contact you to move it. If you cannot attend, cancel or reschedule in the app or call the clinic.',
      ],
    },
    {
      heading: 'Health information and emergencies',
      paragraphs: [
        'Dentor is not a healthcare provider and does not give medical advice. Treatment and advice come from your clinic and its dentists, who are responsible for them.',
        'The app is not for emergencies. Chat is answered during clinic hours. For severe pain, swelling, bleeding or an injury, call the clinic or go to the nearest emergency service.',
      ],
    },
    {
      heading: 'Records and bills',
      paragraphs: [
        'What you see comes from the clinic’s records; ask the clinic if something looks wrong. Bills are paid at the clinic: the app does not take payments.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'Do not misuse the app: no false information, no messages or uploads that are unlawful, abusive or not your own, and no attempts to reach information that is not yours. We may suspend an account that breaks these terms.',
      ],
    },
    {
      heading: 'Availability and liability',
      paragraphs: [
        'We work to keep the app available and correct but cannot promise it will always be. To the extent the law allows, Dentor is not liable for losses that come from the clinic’s services or from interruptions outside our control.',
      ],
    },
    deletionSection('In the Dentor app, open Profile › Delete account'),
    { heading: 'Law', paragraphs: ['These terms are governed by the laws of India.'] },
    { heading: 'Changes', paragraphs: ['We may update these terms; the app shows a notice before a significant change takes effect.'] },
    contactSection,
  ],
}

export const STAFF_PRIVACY: LegalDocument = {
  title: 'Privacy Policy',
  notice: DRAFT_NOTICE,
  updated: LEGAL_DETAILS.updated,
  sections: [
    {
      heading: 'Who we are',
      paragraphs: [
        `This policy covers the Dentor Clinic Owner and Dentor Consultant apps and the Dentor web app for clinics, provided by ${COMPANY} ("Dentor", "we").`,
      ],
    },
    {
      heading: 'What we collect about you',
      paragraphs: [
        'Your name, email, mobile number, role and clinic, and a password stored only in scrambled form. For consultants, the professional details given when applying (qualifications, registration, experience, location). Only the last four digits of an Aadhaar number are kept.',
        'Your activity in the apps (appointments, records and messages you create), and a session and notification token on your device.',
      ],
    },
    {
      heading: 'Patient information',
      paragraphs: [
        'Patient records belong to the clinic that created them, and the clinic is responsible for them. You may use them only to provide care and run the clinic. A consultant sees only the cases a clinic sends them and the patients they treat.',
      ],
    },
    {
      heading: 'How we use and share it',
      paragraphs: [
        'To run the apps for your clinic, sign you in, send notifications and emails, keep the service secure and support you. We do not sell information or use it for advertising.',
        'Service providers that help us run Dentor see information only for that purpose: the server host, the SMS and email services, and the notification services of Google and Apple. We may disclose information when the law requires it.',
      ],
    },
    {
      heading: 'On your phone',
      paragraphs: [
        'Fingerprint or face sign-in uses your phone’s own check; no fingerprint or face data reaches Dentor. Photos and files are read only when you choose to upload them.',
      ],
    },
    {
      heading: 'Security, storage and your rights',
      paragraphs: [
        'Information travels over encrypted connections and is kept on servers we control, with access limited to those who need it. You can ask us for a copy of your information, its correction, or its erasure.',
      ],
    },
    deletionSection('In the Clinic Owner app open More › Settings › Delete Account; in the Consultant app open Profile › Settings › Delete Account'),
    { heading: 'Changes to this policy', paragraphs: ['We will show a notice in the apps before a significant change takes effect.'] },
    contactSection,
  ],
}

export const STAFF_TERMS: LegalDocument = {
  title: 'Terms & Conditions',
  notice: DRAFT_NOTICE,
  updated: LEGAL_DETAILS.updated,
  sections: [
    {
      heading: 'Who may use the apps',
      paragraphs: [
        'Clinics registered with Dentor, their staff, and consultants approved by Dentor. Consultants must hold valid dental qualifications and registration and keep them current.',
      ],
    },
    {
      heading: 'Your login',
      paragraphs: [
        'Logins are personal. Keep your password to yourself, use the role your clinic gave you, and tell your clinic administrator or Dentor if you think your login was used by someone else.',
      ],
    },
    {
      heading: 'Patient information',
      paragraphs: [
        'Use patient information only to provide care and run the clinic, keep it confidential, and follow the laws on health records and data protection that apply to you and your clinic.',
      ],
    },
    {
      heading: 'Bookings and fees',
      paragraphs: [
        'Fees are shown in the apps and paid at the clinic. Dentor does not take or refund payments in the apps in this version.',
      ],
    },
    {
      heading: 'Medical responsibility',
      paragraphs: [
        'Dentor is software and is not a healthcare provider. Diagnosis and treatment decisions belong to the treating dentist, who is responsible for them.',
      ],
    },
    {
      heading: 'Acceptable use and suspension',
      paragraphs: [
        'Do not misuse the apps or try to reach information you are not allowed to see. Dentor may suspend a login or clinic that breaks these terms or the law.',
      ],
    },
    deletionSection('In the Clinic Owner app open More › Settings › Delete Account; in the Consultant app open Profile › Settings › Delete Account'),
    { heading: 'Law', paragraphs: ['These terms are governed by the laws of India.'] },
    contactSection,
  ],
}

/** The public "how to delete your account" page the store listings link to. */
export const ACCOUNT_DELETION: LegalDocument = {
  title: 'Delete your Dentor account',
  notice: '',
  updated: LEGAL_DETAILS.updated,
  sections: [
    {
      heading: 'In the app',
      paragraphs: [
        'Dentor (patients): Profile › Delete account, then enter your password and confirm.',
        'Dentor Clinic Owner: More › Settings › Delete Account, then enter your password and confirm.',
        'Dentor Consultant: Profile › Settings › Delete Account, then enter your password and confirm.',
        'Your login stops working at once and you are logged out on every device.',
      ],
    },
    {
      heading: 'Without the app',
      paragraphs: [
        `Write to ${CONTACT} from the email on the account, or with the mobile number of the account, and say which app it is. We confirm it is you and delete the login within 7 days.`,
      ],
    },
    {
      heading: 'What is deleted and what is kept',
      paragraphs: [
        'Deleted: your login. It is hidden and stops working; your mobile number and email are freed for a new account.',
        'Kept: the deleted login, so Dentor support can restore it if you ask; tell us if you want it removed permanently. Records clinics must keep by law (patient records, prescriptions, consent forms, bills) stay with the clinic.',
      ],
    },
    contactSection,
  ],
}
