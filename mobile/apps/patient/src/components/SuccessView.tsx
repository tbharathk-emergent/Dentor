import { colors, imageSource, space } from '@dentor/shared'
import type { ReactNode } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import mascot from '@/assets/design/mascot-popup.png'

/**
 * The "all done" moment after sign-up, a password reset or a booking, with the design's tooth
 * mascot holding the sign (frames "sucessfully registered popup" 4:5421 and "sucessfully
 * Booked" 98:4010). The title is Noto Sans Bold, the message small and centred under it.
 */
export function SuccessView({
  title,
  message,
  children,
  testID,
}: {
  title: string
  message: string
  /** Optional details under the message, e.g. the booked appointment. */
  children?: ReactNode
  testID?: string
}) {
  return (
    <View testID={testID} style={styles.wrap}>
      <Image source={imageSource(mascot)} style={styles.mascot} resizeMode="contain" accessibilityIgnoresInvertColors />
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {children ? <View style={styles.details}>{children}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: space.xl },
  mascot: { width: 200, height: 160 },
  title: { fontFamily: 'NotoSans-Bold', fontSize: 20, lineHeight: 26, color: '#000000', textAlign: 'center' },
  message: { maxWidth: 340, fontFamily: 'NotoSans-Regular', fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  details: { alignSelf: 'stretch', marginTop: space.md },
})
