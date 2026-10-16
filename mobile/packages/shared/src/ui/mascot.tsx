import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { imageSource } from '../image'
import { colors, face, space } from '../theme'

export interface MascotAction {
  label: string
  onPress: () => void
  /** The second button of a pair is drawn outlined. */
  secondary?: boolean
  testID?: string
}

/**
 * The designs' pop-up: the tooth mascot holding a white sign with the message written on it
 * and one or two pill buttons underneath (dentor.fig: "Successfully Registered", "Your Request Is
 * Important", "Confirm Delete", …). Each app passes its own mascot image, since the art is in
 * the app's design assets.
 */
export function MascotDialog({
  visible,
  image,
  title,
  message,
  details,
  actions,
  tone = 'brand',
  onClose,
  testID,
}: {
  visible: boolean
  image: number | string
  title?: string
  message?: string
  /** Lines shown under the message, e.g. a booking summary. */
  details?: string[]
  actions: MascotAction[]
  /** "danger" outlines the sign in red, as the design's warnings do. */
  tone?: 'brand' | 'danger'
  onClose?: () => void
  testID?: string
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose ?? (() => {})}>
      <View style={styles.veil}>
        <View testID={testID} style={styles.wrap} accessibilityViewIsModal>
          <Image source={imageSource(image)} style={styles.mascot} resizeMode="contain" accessibilityIgnoresInvertColors />
          <View style={[styles.sign, tone === 'danger' && styles.signDanger]}>
            {!!title && <Text accessibilityRole="header" style={[styles.title, tone === 'danger' && { color: colors.red }]}>{title}</Text>}
            {!!message && <Text style={styles.message}>{message}</Text>}
            {details?.map((line) => (
              <Text key={line} style={styles.detail}>• {line}</Text>
            ))}
            <View style={styles.actions}>
              {actions.map((a) => (
                <Pressable
                  key={a.label}
                  testID={a.testID}
                  accessibilityRole="button"
                  onPress={a.onPress}
                  style={({ pressed }) => [styles.button, a.secondary && styles.secondary, pressed && { opacity: 0.85 }]}
                >
                  <Text style={[styles.buttonText, a.secondary && { color: colors.header }]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  veil: { flex: 1, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  wrap: { width: '100%', maxWidth: 360, alignItems: 'center' },
  // The art is the mascot above an empty sign; the sign below carries the words.
  mascot: { width: 220, height: 150, marginBottom: -6 },
  sign: {
    width: '100%', gap: space.sm, paddingVertical: space.lg, paddingHorizontal: space.lg, backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#bdbcbc', alignItems: 'center',
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  signDanger: { borderColor: colors.red, borderWidth: 2 },
  title: { ...face('bold'), fontSize: 16, lineHeight: 22, color: colors.title, textAlign: 'center' },
  message: { ...face('medium'), fontSize: 13, lineHeight: 19, color: '#000000', textAlign: 'center' },
  detail: { ...face('medium'), fontSize: 12, lineHeight: 18, color: '#000000', alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md, marginTop: space.xs },
  button: { minWidth: 96, minHeight: 34, paddingHorizontal: space.lg, borderRadius: 17, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: colors.header },
  buttonText: { ...face('bold'), fontSize: 13, lineHeight: 18, color: '#ffffff' },
})
