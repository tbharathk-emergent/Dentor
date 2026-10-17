import { View } from 'react-native'
import { colors, space } from '../../theme'
import { Screen } from '../../ui/layout'
import { Banner, T } from '../../ui/primitives'
import type { LegalDocument } from '../../legal/content'

/** "Privacy Policy" and "Terms & Conditions" (dentor.fig 290–293, 430–433). */
export function LegalScreen({ document, testID }: { document: LegalDocument; testID: string }) {
  return (
    <Screen testID={testID} title={document.title} back>
      {!!document.notice && <Banner tone="amber" icon="alert-triangle" text={document.notice} />}
      <T variant="tiny" color={colors.textMuted}>Last updated {document.updated}</T>
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
