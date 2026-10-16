import { imageSource } from '@dentor/shared'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import endo from '@/assets/design/spec-endodontics.png'
import general from '@/assets/design/spec-general.png'
import oral from '@/assets/design/spec-oral-surgery.png'
import ortho from '@/assets/design/spec-orthodontics.png'
import perio from '@/assets/design/spec-periodontics.png'
import prostho from '@/assets/design/spec-prosthodontics.png'

/** The specialities the design offers on the clinic's home (dentor.fig "Home" 37:626), in its order. */
export const SPECIALTIES = [
  { key: 'General Dentistry', label: 'General Dentistry', image: general },
  { key: 'Orthodontics', label: 'ORTHODONTICS', image: ortho },
  { key: 'Periodontics', label: 'PERIODONTICS', image: perio },
  { key: 'Endodontics', label: 'ENDODONTICS', image: endo },
  { key: 'Oral Surgery', label: 'ORAL SURGERY', image: oral },
  { key: 'Prosthodontics', label: 'PROSTHODONTICS', image: prostho },
] as const

/**
 * "BOOK APPOINTMENT": a red band down the left with the words set vertically, and the
 * specialities three to a row (icons 75 × 71, labels Roboto Medium 8 in red, set larger here to be
 * readable). Choosing one starts a consultant booking for that speciality.
 */
export function Specialties({ onPick }: { onPick?: (specialty: string) => void }) {
  return (
    <View testID="specialties" style={styles.card}>
      <View style={styles.band}>
        <Text style={styles.bandText}>BOOK APPOINTMENT</Text>
      </View>
      <View style={styles.grid}>
        {SPECIALTIES.map((s) => (
          <Pressable
            key={s.key}
            testID={`specialty-${s.key}`}
            accessibilityRole="button"
            accessibilityLabel={`Book ${s.key}`}
            disabled={!onPick}
            onPress={() => onPick?.(s.key)}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.8 }]}
          >
            <Image source={imageSource(s.image)} style={styles.icon} resizeMode="contain" accessibilityIgnoresInvertColors />
            <Text numberOfLines={1} style={styles.label}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 8, overflow: 'hidden',
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  band: { width: 26, backgroundColor: '#ff1010', borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  // The band's words read bottom to top, as in the design.
  bandText: { width: 190, transform: [{ rotate: '-90deg' }], fontFamily: 'NotoSans-Bold', fontSize: 12, letterSpacing: 3, color: '#ffffff', textAlign: 'center' },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 10 },
  item: { width: '33.33%', alignItems: 'center', paddingVertical: 6, gap: 4 },
  icon: { width: 66, height: 63 },
  label: { fontFamily: 'Roboto-SemiBold', fontSize: 10, lineHeight: 13, color: '#ff0000' },
})
