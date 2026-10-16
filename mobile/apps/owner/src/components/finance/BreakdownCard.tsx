import { BarList, Card, Section, T, colors, fmtINR, type Tone } from '@dentor/shared'
import { plural } from '@/lib/format'
import type { AmountBucket } from '@/types'

/** Rupees split by payment mode, doctor or treatment, largest first (the API's order). */
export function BreakdownCard({
  title,
  buckets,
  countNoun,
  emptyText,
  tone,
  testID,
}: {
  title: string
  buckets: AmountBucket[]
  /** What `count` counts, singular: "payment" or "invoice". */
  countNoun: string
  emptyText: string
  tone?: Tone
  testID: string
}) {
  return (
    <Section title={title}>
      <Card testID={testID}>
        {buckets.length === 0 ? (
          <T variant="small" color={colors.textMuted} testID={`${testID}-empty`}>
            {emptyText}
          </T>
        ) : (
          <BarList
            tone={tone}
            format={fmtINR}
            rows={buckets.map((bucket) => ({ label: bucket.name, value: bucket.amount, hint: plural(bucket.count, countNoun) }))}
          />
        )}
      </Card>
    </Section>
  )
}
