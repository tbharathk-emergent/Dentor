import { Badge, Icon, space } from '@dentor/shared'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ReportFile } from '@/types'

/**
 * An X-ray, report or document as the design lists it (frame "xray & records" 46:470): a
 * white card, radius 12, with the drop shadow; a 36 pt #e0e7ff tile, the name in Roboto
 * SemiBold 14 #111827, the clinic (here: category and size) in Roboto 12 #6b7280, and a
 * "View" pill in #2c7d7d. Files the patient uploaded are marked as theirs.
 */
export function ReportRow({ file, subtitle, onPress }: { file: ReportFile; subtitle: string; onPress: () => void }) {
  return (
    <Pressable testID={`report-card-${file.id}`} accessibilityRole="button" accessibilityLabel={`${file.name}, view`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <View style={styles.tile}>
        <Icon name={file.is_image ? 'image' : 'file-text'} size={18} color="#4f46e5" />
      </View>
      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.name}>{file.name}</Text>
        <Text numberOfLines={1} style={styles.sub}>{subtitle}</Text>
        {file.mine && <Badge label="Uploaded by you" tone="brand" />}
      </View>
      <View style={styles.view}>
        <Text style={styles.viewText}>View</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.md, paddingHorizontal: 16,
    borderRadius: 12, backgroundColor: '#ffffff', shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  tile: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  body: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: 'Roboto-SemiBold', fontSize: 14, lineHeight: 17, color: '#111827' },
  sub: { fontFamily: 'Roboto-Regular', fontSize: 12, lineHeight: 15, color: '#6b7280' },
  view: { minHeight: 30, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#2c7d7d', justifyContent: 'center' },
  viewText: { fontFamily: 'Roboto-SemiBold', fontSize: 12, lineHeight: 18, color: '#ffffff' },
})
