import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from '../../navigation'
import { colors, face, radius, space } from '../../theme'
import { Screen } from '../../ui/layout'
import { Banner, Button, Icon, Segmented, T, TextField } from '../../ui/primitives'

export interface HelpContact {
  label: string
  /** A https:, mailto: or tel: link. */
  url: string
}

const FAQ = [
  { q: 'How do I book a consultant for a patient?', a: 'From the home screen, pick a speciality (or open Consultant Bookings in the menu), fill in the case and choose a consultant and a free slot, or let Dentor choose.' },
  { q: 'Can I book for today?', a: 'Yes, when the consultant has free time today. Their free slots are shown when you choose the date.' },
  { q: 'How do I reschedule or cancel an appointment?', a: 'Open the appointment from My Appointments and use Reschedule or Cancel. A reason is asked for so the patient can be told.' },
  { q: 'How does the consultant start a procedure?', a: 'The clinic sees a 4-digit code on the booking once it is confirmed. Read it to the consultant at the chair; the consultant enters it to start.' },
  { q: 'Why does a payment button not appear?', a: 'Payments are taken at the clinic. Dentor does not collect or refund money in the app in this version.' },
  { q: 'How do I reset my password?', a: 'On the login screen tap Forget Password. A 4-digit code is emailed to you.' },
  { q: 'How do I turn on fingerprint sign-in?', a: 'In your profile, turn on Fingerprint sign-in. Your fingerprint never leaves your phone.' },
  { q: 'Who sees the clinic’s accounts?', a: 'Only the owner, administrators and accountants. Other roles do not see money in the app.' },
]

/**
 * "Help center" (dentor.fig 294–295, 302, 434–436): searchable FAQ and the ways to reach Dentor. Contact links are
 * the ones the app is configured with; without any, support is reached through a ticket.
 */
export function HelpScreen({ contacts = [] }: { contacts?: HelpContact[] }) {
  const router = useRouter()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<'faq' | 'contact'>(params.tab === 'contact' ? 'contact' : 'faq')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const items = FAQ.filter((f) => !q.trim() || `${f.q} ${f.a}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <Screen testID="help-screen" title="Help center" back>
      <T variant="h3">How can we help you?</T>
      <Segmented options={[{ key: 'faq', label: 'FAQ' }, { key: 'contact', label: 'Contact us' }]} value={tab} onChange={setTab} />
      {tab === 'faq' ? (
        <>
          <TextField testID="help-search" icon="search" value={q} onChangeText={setQ} placeholder="Search..." autoCapitalize="none" />
          {items.map((f, i) => (
            <Pressable key={f.q} testID={`faq-${i}`} accessibilityRole="button" onPress={() => setOpen(open === i ? null : i)} style={styles.faq}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={styles.question}>{f.q}</Text>
                <Icon name={open === i ? 'chevron-up' : 'chevron-down'} />
              </View>
              {open === i && <T color={colors.textMuted}>{f.a}</T>}
            </Pressable>
          ))}
          {!items.length && <T color={colors.textMuted}>Nothing matches. Raise a ticket and support will answer.</T>}
        </>
      ) : (
        <>
          {contacts.map((c) => (
            <Button key={c.url} label={c.label} icon="external-link" variant="secondary" full onPress={() => Linking.openURL(c.url).catch(() => undefined)} />
          ))}
          {!contacts.length && <Banner tone="blue" icon="info" text="Reach Dentor's support team with a ticket; they answer in the app." />}
          <Button testID="help-ticket" label="Raise a Ticket" icon="life-buoy" full onPress={() => router.push('/support')} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  faq: { gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  question: { ...face('semibold'), fontSize: 15, lineHeight: 21, color: colors.textStrong, flex: 1 },
})
