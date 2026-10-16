import { imageSource } from '@dentor/shared'
import { Image, StyleSheet, Text, View } from 'react-native'
import doctor from '@/assets/design/banner-doctor.png'

/**
 * The design's teal banner with the clinic's doctor (frames "xray & records" 46:470,
 * "SCHEDULER" 18:163): #47b5be, radius 10, Work Sans Bold 20 in white.
 */
export function InfoBanner({ text, testID }: { text: string; testID?: string }) {
  return (
    <View testID={testID} style={styles.banner}>
      <Text style={styles.text}>{text}</Text>
      <Image source={imageSource(doctor)} style={styles.doctor} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  )
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'flex-end', minHeight: 89, borderRadius: 10, backgroundColor: '#47b5be', paddingLeft: 12 },
  text: { flex: 1, minWidth: 0, paddingVertical: 12, fontFamily: 'WorkSans-Bold', fontSize: 20, lineHeight: 24, color: '#ffffff' },
  doctor: { width: 96, height: 124, marginTop: -36 },
})
