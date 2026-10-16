import { Avatar, Icon, T, colors, fmtINR, radius, shadow, space } from '@dentor/shared'
import { Pressable, StyleSheet, View } from 'react-native'
import type { Doctor } from '@/types'

/** A doctor to choose when booking: who they are, when they sit, their fee and rating. */
export function DoctorCard({ doctor, selected, onPress }: { doctor: Doctor; selected: boolean; onPress: () => void }) {
  const facts = [doctor.credentials, doctor.experience ? `${doctor.experience} yrs` : ''].filter(Boolean).join(' · ')
  return (
    <Pressable
      testID={`doctor-option-${doctor.id}`}
      accessibilityRole="radio"
      accessibilityLabel={doctor.name}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.card, selected && styles.cardOn]}
    >
      <Avatar name={doctor.name} size={48} />
      <View style={styles.body}>
        <T variant="bodyStrong" numberOfLines={1}>{doctor.name}</T>
        {!!doctor.specialty && <T variant="small" color={colors.textMuted} numberOfLines={2}>{doctor.specialty}</T>}
        {!!facts && <T variant="small" color={colors.textMuted} numberOfLines={1}>{facts}</T>}
        <View style={styles.meta}>
          {!!doctor.availability && <Fact icon="clock" text={doctor.availability} />}
          {doctor.fee > 0 && <Fact icon="credit-card" text={`${fmtINR(doctor.fee)} consultation`} />}
          {doctor.rating > 0 && <Fact icon="star" text={doctor.rating.toFixed(1)} />}
        </View>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <Icon name="check" size={14} color={colors.onBrand} />}</View>
    </Pressable>
  )
}

function Fact({ icon, text }: { icon: 'clock' | 'credit-card' | 'star'; text: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={13} color={colors.textFaint} />
      <T variant="tiny" color={colors.textMuted}>{text}</T>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, ...shadow,
  },
  cardOn: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xs, marginTop: space.xs },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  radio: {
    width: 22, height: 22, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
})
