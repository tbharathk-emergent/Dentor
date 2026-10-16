import { Icon, T, toneColors, radius, space, type IconName, type Tone } from '@dentor/shared'
import { Pressable, StyleSheet, View } from 'react-native'

/** A one-line reminder on the home screen that opens the screen where it can be dealt with. */
export function HomeNotice({
  icon,
  tone,
  title,
  detail,
  onPress,
  testID,
}: {
  icon: IconName
  tone: Tone
  title: string
  detail: string
  onPress: () => void
  testID: string
}) {
  const c = toneColors[tone]
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.notice, { backgroundColor: c.bg }, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={c.fg} />
      <View style={styles.text}>
        <T variant="bodyStrong" color={c.fg}>{title}</T>
        <T variant="small" color={c.fg}>{detail}</T>
      </View>
      <Icon name="chevron-right" size={18} color={c.fg} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md },
  text: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
})
