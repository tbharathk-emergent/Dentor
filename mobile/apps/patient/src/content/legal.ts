/**
 * Placeholder wording for the two policy screens. It describes how the app behaves in plain
 * language and makes no legal promises; each clinic's own approved text replaces it.
 */
export interface LegalDocument {
  title: string
  /** Shown in a notice at the top so nobody mistakes this for the clinic's final policy. */
  notice: string
  sections: { heading: string; paragraphs: string[] }[]
}

export const TERMS: LegalDocument = {
  title: 'Terms of use',
  notice:
    'Placeholder for the clinic’s Terms of use. This general description will be replaced by the text your clinic approves. Ask the clinic for its current terms.',
  sections: [
    {
      heading: 'What this app is for',
      paragraphs: [
        'The app lets you book and manage visits, see your dental records, prescriptions, reports and bills, sign consent forms, and message the clinic you are registered with.',
      ],
    },
    {
      heading: 'Your account',
      paragraphs: [
        'Your account is tied to your mobile number. Keep your password to yourself and tell the clinic if you think someone else has used your account.',
        'Family members you add are registered at the clinic under your mobile number.',
      ],
    },
    {
      heading: 'Appointments',
      paragraphs: [
        'A booking made in the app reserves the time shown. The clinic may contact you if it needs to move the visit.',
        'If you cannot attend, please cancel or reschedule in the app, or call the clinic.',
      ],
    },
    {
      heading: 'Records and bills',
      paragraphs: [
        'What you see comes from the clinic’s records. If something looks wrong or is missing, ask the clinic to check it.',
        'Bills are paid at the clinic. The app shows what was billed and what was received; it does not take payments.',
      ],
    },
    {
      heading: 'Not for emergencies',
      paragraphs: [
        'Chat messages are answered by the front desk during working hours. For severe pain, swelling, bleeding or an injury, call the clinic or go to the nearest emergency service.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: ['The clinic may update its terms. The version the clinic publishes is the one that applies.'],
    },
  ],
}

export const PRIVACY: LegalDocument = {
  title: 'Privacy policy',
  notice:
    'Placeholder for the clinic’s Privacy policy. This general description of how the app handles information will be replaced by the text your clinic approves. Ask the clinic for its current policy.',
  sections: [
    {
      heading: 'What the app shows',
      paragraphs: [
        'Your profile, appointments, treatment records, dental chart, prescriptions, reports, bills, consent forms, reviews and your chat with the clinic. This information is held by the clinic you are registered with.',
      ],
    },
    {
      heading: 'What you add',
      paragraphs: [
        'Details you type, files you upload, messages, reviews and bookings are sent to your clinic so its staff can act on them.',
        'The app opens your photo library or files only when you choose to upload something.',
      ],
    },
    {
      heading: 'On this device',
      paragraphs: [
        'The app keeps you logged in by storing a session on this device. Logging out removes it.',
        'If you allow notifications, the device is registered so the clinic’s reminders and updates can reach you.',
      ],
    },
    {
      heading: 'Deleting your account',
      paragraphs: [
        'Deleting your account removes your app login. The records the clinic holds about your care stay with the clinic.',
      ],
    },
    {
      heading: 'Questions',
      paragraphs: ['For anything about your information, contact the clinic. Its phone number and email are under Profile › Clinic information.'],
    },
  ],
}
