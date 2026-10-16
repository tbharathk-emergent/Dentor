import { Card, StatusBadge, T, colors, radius, space } from '@dentor/shared'
import { StyleSheet, View } from 'react-native'
import { Stars } from '@/components/reviews/StarRating'
import type { Review } from '@/types'

/** A review the patient wrote, where it stands with the clinic, and the clinic's reply if any. */
export function ReviewCard({ review }: { review: Review }) {
  return (
    <Card testID="review" style={styles.card}>
      <View style={styles.head}>
        <View style={styles.title}>
          <T variant="bodyStrong" numberOfLines={1}>{review.subject}</T>
          <T variant="small" color={colors.textMuted}>{[review.date, review.visit].filter(Boolean).join(' · ')}</T>
        </View>
        <StatusBadge status={review.status} />
      </View>
      <Stars rating={review.rating} />
      {(!!review.tags?.length || review.recommend != null) && (
        <T testID="review-tags" variant="small" color={colors.textMuted}>
          {[...(review.tags ?? []), review.recommend == null ? '' : review.recommend ? 'Recommends the clinic' : 'Does not recommend'].filter(Boolean).join(' · ')}
        </T>
      )}
      <T testID="review-text">{review.text}</T>
      {review.status === 'Pending' && (
        <T variant="small" color={colors.textMuted}>Waiting for the clinic to approve it before it is shown to others.</T>
      )}
      {!!review.response && (
        <View testID="review-response" style={styles.response}>
          <T variant="tiny" color={colors.brand800}>REPLY FROM THE CLINIC</T>
          <T variant="small">{review.response}</T>
        </View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  title: { flex: 1, minWidth: 0 },
  response: { gap: 2, padding: space.md, borderRadius: radius.md, backgroundColor: colors.brand50 },
})
