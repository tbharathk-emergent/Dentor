import { Banner, Card, Section, T, colors, space } from '@dentor/shared'
import { Figure, FigureGrid } from '@/components/Figure'
import type { Operations } from '@/types'

/** Patient reviews: the average rating, how many there are, and how many still wait for approval. */
export function ReviewsCard({ reviews }: { reviews: Operations['reviews'] }) {
  return (
    <Section title="Reviews">
      <Card testID="reviews-card" style={{ gap: space.md }}>
        {reviews.total === 0 ? (
          <T variant="small" color={colors.textMuted} testID="reviews-empty">
            No patient reviews yet.
          </T>
        ) : (
          <>
            <FigureGrid>
              <Figure testID="reviews-average" label="AVERAGE RATING" value={reviews.average ? `${reviews.average.toFixed(1)} of 5` : 'Not rated'} />
              <Figure testID="reviews-total" label="REVIEWS" value={reviews.total} />
              <Figure testID="reviews-pending" label="AWAITING MODERATION" value={reviews.pending} />
            </FigureGrid>
            {reviews.pending > 0 && <Banner tone="amber" icon="clock" text="Pending and flagged reviews are approved or rejected in the reception app." />}
          </>
        )}
      </Card>
    </Section>
  )
}
