import { Icon, T, TOUCH, colors, radius, space } from '@dentor/shared'
import { Pressable, StyleSheet, View } from 'react-native'

const STARS = [1, 2, 3, 4, 5]
const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

/** Small read-only row of stars for a review that was already given. */
export function Stars({ rating }: { rating: number }) {
  return (
    <View accessibilityLabel={`${rating} out of 5 stars`} style={styles.compact}>
      {STARS.map((star) => (
        <Icon key={star} name="star" size={15} color={star <= rating ? colors.amber : colors.borderStrong} />
      ))}
    </View>
  )
}

/** Five large stars to tap, with the chosen rating put into words. */
export function StarRating({ label, value, onChange, error }: { label: string; value: number; onChange: (rating: number) => void; error?: string }) {
  return (
    <View style={styles.wrap}>
      <T variant="smallStrong">{label}</T>
      <View style={styles.row}>
        {STARS.map((star) => {
          const on = star <= value
          return (
            <Pressable
              key={star}
              testID={`star-${star}`}
              accessibilityRole="button"
              accessibilityLabel={`${star} ${star === 1 ? 'star' : 'stars'}`}
              accessibilityState={{ selected: on }}
              onPress={() => onChange(star)}
              style={[styles.star, on && styles.starOn]}
            >
              <Icon name="star" size={24} color={on ? colors.amber : colors.borderStrong} />
            </Pressable>
          )
        })}
      </View>
      {error ? (
        <T variant="small" color={colors.red}>{error}</T>
      ) : (
        <T variant="small" color={colors.textMuted} testID="rating-word">{WORDS[value] || 'Tap a star to rate'}</T>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  compact: { flexDirection: 'row', gap: 2 },
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  star: {
    flex: 1, maxWidth: 56, height: TOUCH + 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  starOn: { backgroundColor: colors.amberBg, borderColor: colors.amber },
})
