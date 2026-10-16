import { Button, EmptyState, QueryState, Screen } from '@dentor/shared'
import { InfoBanner } from '@/components/InfoBanner'
import { PatientHeader } from '@/components/PatientHeader'
import { Rows } from '@/components/Rows'
import { ReviewCard } from '@/components/reviews/ReviewCard'
import { useRefresh } from '@/hooks/useRefresh'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'
import { useReviews } from '@/hooks/useReviews'
import { useRouter } from '@/nav'

export default function Reviews() {
  const router = useRouter()
  const list = useReviews()
  const { refreshing, onRefresh } = useRefresh(list.refetch)
  // A tab stays mounted: coming back to it shows fresh data.
  useRefreshOnFocus(list.refetch)

  return (
    <Screen
      testID="reviews-screen"
      header={<PatientHeader />}
      refreshing={refreshing}
      onRefresh={onRefresh}
      footer={<Button testID="review-write" label="Write a review" icon="edit-2" full onPress={() => router.push('/reviews/new')} />}
    >
      <InfoBanner text="Rate Your Experience" />
      <QueryState query={list}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState testID="reviews-empty" icon="star" title="You have not written a review yet" message="Tell the clinic how your visit went. Your feedback helps them and other patients." />
          ) : (
            <Rows testID="review-list">
              {data.items.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </Rows>
          )
        }
      </QueryState>
    </Screen>
  )
}
