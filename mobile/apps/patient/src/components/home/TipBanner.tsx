import { imageSource } from '@dentor/shared'
import { Image, StyleSheet, Text, View } from 'react-native'
import doctor from '@/assets/design/banner-doctor.png'
import { tipFor } from '@/content/dentalTips'

/**
 * Today's dental tip on the design's banner (frame "Home" 6:1887): #47b5be, radius 10, the
 * tip's title in gold and its text in white, Work Sans Bold 12, the clinic's doctor on the right.
 */
export function TipBanner() {
  const tip = tipFor(new Date())
  return (
    <View testID="home-tip" style={styles.banner}>
      <Text style={styles.text}>
        <Text style={styles.title}>{tip.title}: </Text>
        {tip.text}
      </Text>
      <Image source={imageSource(doctor)} style={styles.doctor} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  )
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'flex-end', minHeight: 89, borderRadius: 10, backgroundColor: '#47b5be', paddingLeft: 11, overflow: 'visible' },
  text: { flex: 1, minWidth: 0, paddingVertical: 9, fontFamily: 'WorkSans-Bold', fontSize: 12, lineHeight: 14, color: '#ffffff' },
  title: { color: '#ffc909' },
  doctor: { width: 81, height: 104, marginTop: -15 },
})
