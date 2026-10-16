import { View } from 'react-native'
import { colors, space } from '../../theme'
import { Screen } from '../../ui/layout'
import { Banner, T } from '../../ui/primitives'

type Doc = { title: string; sections: { heading: string; paragraphs: string[] }[] }

const NOTICE = 'Placeholder for Dentor’s approved text. This plain description of how the app behaves will be replaced by the policy Dentor publishes.'

export const STAFF_PRIVACY: Doc = {
  title: 'Privacy Policy',
  sections: [
    { heading: 'What we keep', paragraphs: ['Your name, email, mobile, role and clinic; for consultants, the professional details given when applying. Only the last four digits of an Aadhaar number are kept.'] },
    { heading: 'Patient information', paragraphs: ['Patient records stay with the clinic that created them. A consultant sees the cases sent to them and the patients they treat.'] },
    { heading: 'Fingerprint and face', paragraphs: ['Fingerprint or face sign-in uses your phone’s own check. No fingerprint or face data reaches the app or Dentor.'] },
    { heading: 'Messages and notifications', paragraphs: ['Messages, tickets and notifications are stored so you can read them later. Text messages and WhatsApp are not sent by the app.'] },
  ],
}

export const STAFF_TERMS: Doc = {
  title: 'Terms & Conditions',
  sections: [
    { heading: 'Who may use the apps', paragraphs: ['Clinics and consultants approved by Dentor. Consultants must hold valid dental qualifications and registration.'] },
    { heading: 'Bookings and fees', paragraphs: ['Fees are shown in the app and paid at the clinic. Dentor does not take or refund payments in the app in this version.'] },
    { heading: 'Medical disclaimer', paragraphs: ['Dentor is not a healthcare provider and does not give medical advice. Treatment decisions belong to the treating dentist.'] },
  ],
}

/** "Privacy Policy" and "Terms & Conditions" (dentor.fig 290–293, 430–433). */
export function LegalScreen({ document, testID }: { document: Doc; testID: string }) {
  return (
    <Screen testID={testID} title={document.title} back>
      <Banner tone="amber" icon="alert-triangle" text={NOTICE} />
      {document.sections.map((s) => (
        <View key={s.heading} style={{ gap: space.sm }}>
          <T variant="h3">{s.heading}</T>
          {s.paragraphs.map((p) => <T key={p} color={colors.textMuted}>{p}</T>)}
        </View>
      ))}
      <T variant="tiny" color={colors.textMuted}>A Unit Of IQDS DENTAL INDIA Pvt. Ltd.</T>
    </Screen>
  )
}
