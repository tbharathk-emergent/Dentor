import { imageSource } from '@dentor/shared'
import { Image, StyleSheet, View } from 'react-native'
import logo from '@/assets/design/logo-on-teal.png'

/** The design's first screen (frame "First Screen" 2:648): the DENTOR logo on #1d8992. */
export function Splash() {
  return (
    <View testID="splash" style={styles.root}>
      <Image source={imageSource(logo)} style={styles.logo} resizeMode="contain" accessibilityLabel="DENTOR, Dentistry Amassed" />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#1d8992' },
  logo: { width: '86%', maxWidth: 420, aspectRatio: 253 / 97 },
})
