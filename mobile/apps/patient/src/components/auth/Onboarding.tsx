import { Button, IconTile, T, ToothMark, colors, radius, space, type IconName } from '@dentor/shared'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const SLIDES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'calendar',
    title: 'Book visits in a few taps',
    text: 'Choose your dentist, pick a free time, and reschedule whenever your plans change.',
  },
  {
    icon: 'clipboard',
    title: 'Records and reports in one place',
    text: 'See your treatments, dental chart, prescriptions, X-rays and bills whenever you need them.',
  },
  {
    icon: 'message-circle',
    title: 'Chat and reminders',
    text: 'Message the front desk, and get reminders about your appointments and bills.',
  },
]

/** Three short slides for a first-time visitor, ending in "Get started" or "I already have an account". */
export function Onboarding({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const last = index === SLIDES.length - 1

  return (
    <View testID="onboarding" style={[styles.root, { paddingTop: insets.top + space.sm, paddingBottom: Math.max(insets.bottom, space.lg) }]}>
      <View style={styles.column}>
        <View style={styles.top}>
          {!last && <Button testID="onboarding-skip" label="Skip" variant="ghost" size="sm" style={styles.skip} onPress={() => setIndex(SLIDES.length - 1)} />}
        </View>

        <View style={styles.slide}>
          <View style={styles.art}>
            <ToothMark size={136} />
            <View style={styles.artIcon}>
              <IconTile icon={slide.icon} size={56} />
            </View>
          </View>
          <T variant="h1" center testID="onboarding-title">{slide.title}</T>
          <T color={colors.textMuted} center style={styles.text}>{slide.text}</T>
        </View>

        <View style={styles.dots}>
          {SLIDES.map((item, i) => (
            <Pressable
              key={item.title}
              testID={`onboarding-dot-${i + 1}`}
              accessibilityRole="button"
              accessibilityLabel={`Slide ${i + 1} of ${SLIDES.length}`}
              accessibilityState={{ selected: i === index }}
              hitSlop={14}
              onPress={() => setIndex(i)}
              style={[styles.dot, i === index && styles.dotOn]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          {last ? (
            <Button testID="onboarding-start" label="Get started" size="lg" full onPress={onSignup} />
          ) : (
            <Button testID="onboarding-next" label="Next" size="lg" full onPress={() => setIndex(index + 1)} />
          )}
          <Button testID="onboarding-login" label="I already have an account" variant="ghost" full onPress={onLogin} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: space.xl },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  top: { minHeight: 44, justifyContent: 'center' },
  skip: { alignSelf: 'flex-end', marginRight: -space.md },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  art: { marginBottom: space.lg },
  artIcon: { position: 'absolute', right: -space.md, bottom: -space.sm, borderRadius: radius.lg, borderWidth: 4, borderColor: colors.surface },
  text: { maxWidth: 340 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, paddingVertical: space.xl },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.borderStrong },
  dotOn: { width: 24, backgroundColor: colors.brand700 },
  actions: { gap: space.sm },
})
