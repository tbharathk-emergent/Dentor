import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Checkbox } from '@/components/Checkbox'

/** The design's wording (patient-app.fig, frame "login" 1:8853). */
export const DISCLAIMER_TEXT =
  'This app is not intended to supplement or be a substitute for the expertise and judgement of your dentist/doctor or any other healthcare professional.'

/**
 * The disclaimer a first-time visitor accepts before going on (frame "login" 1:8853): a white
 * card, radius 20, on a pale #eef5fe veil; "Disclaimer:" in Gabriela 20 #1d8992, the text in
 * 16 black, "I understand", and "Agree" (#1d8992, radius 10, Gabriela 20 white), which works
 * once "I understand" is ticked.
 */
export function Disclaimer({ visible, onAgree }: { visible: boolean; onAgree: () => void }) {
  const [understood, setUnderstood] = useState(false)
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.veil}>
        <View testID="disclaimer" style={styles.card} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>Disclaimer:</Text>
          <Text style={styles.text}>{DISCLAIMER_TEXT}</Text>
          <Checkbox testID="disclaimer-understand" checked={understood} onChange={setUnderstood}>
            <Text style={styles.understand}>I understand</Text>
          </Checkbox>
          <Pressable
            testID="disclaimer-agree"
            accessibilityRole="button"
            accessibilityState={{ disabled: !understood }}
            disabled={!understood}
            onPress={onAgree}
            style={({ pressed }) => [styles.agree, !understood && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.agreeText}>Agree</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  veil: { flex: 1, backgroundColor: 'rgba(238,245,254,0.96)', justifyContent: 'center', padding: 7 },
  card: {
    width: '100%', maxWidth: 480, alignSelf: 'center', gap: 14, padding: 19, borderRadius: 20, backgroundColor: '#ffffff',
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  title: { fontFamily: 'Gabriela-Regular', fontSize: 20, lineHeight: 26, color: '#1d8992' },
  // design: Inter Regular 16 (Noto Sans stands in; the app bundles no Inter)
  text: { fontFamily: 'NotoSans-Regular', fontSize: 16, lineHeight: 21, color: '#000000' },
  understand: { fontFamily: 'Gabriela-Regular', fontSize: 16, lineHeight: 20, color: '#1d8992' },
  agree: { alignSelf: 'center', minWidth: 125, height: 40, borderRadius: 10, backgroundColor: '#1d8992', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  agreeText: { fontFamily: 'Gabriela-Regular', fontSize: 20, lineHeight: 26, color: '#ffffff' },
})
