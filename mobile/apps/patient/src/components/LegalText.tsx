import { Banner, T, colors, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import type { LegalDocument } from '@/content/legal'

/** Readable body of a policy document; used on its own screen and in the sign-up sheet. */
export function LegalText({ document, testID }: { document: LegalDocument; testID?: string }) {
  return (
    <View testID={testID} style={styles.wrap}>
      {!!document.notice && <Banner tone="amber" icon="alert-triangle" text={document.notice} />}
      <T variant="tiny" color={colors.textMuted}>Last updated {document.updated}</T>
      {document.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <T variant="h3">{section.heading}</T>
          {section.paragraphs.map((paragraph) => (
            <T key={paragraph} color={colors.textMuted}>{paragraph}</T>
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl },
  section: { gap: space.sm },
})
