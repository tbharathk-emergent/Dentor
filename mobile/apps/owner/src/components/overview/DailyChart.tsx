import { Card, KeyValue, MiniBars, Section, T, colors } from '@dentor/shared'

/**
 * One figure per day of the period as a column chart. A single day is stated in words and a
 * period with nothing in it says so, rather than drawing an empty chart.
 */
export function DailyChart({
  title,
  days,
  format = String,
  emptyText,
  testID,
}: {
  title: string
  days: { label: string; value: number }[]
  format?: (value: number) => string
  emptyText: string
  testID: string
}) {
  const hasValues = days.some((day) => day.value > 0)
  return (
    <Section title={title}>
      <Card testID={testID}>
        {!hasValues ? (
          <T variant="small" color={colors.textMuted} testID={`${testID}-empty`}>
            {emptyText}
          </T>
        ) : days.length === 1 ? (
          <KeyValue label={days[0].label} value={format(days[0].value)} strong />
        ) : (
          <MiniBars data={days} format={format} />
        )}
      </Card>
    </Section>
  )
}
