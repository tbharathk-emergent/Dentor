import { api, EmptyState, QueryState, Screen, T, TextField, colors, face, fmtDate, radius, shadow, space, stripeColors } from '@dentor/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

/**
 * "Reviews" (dentor.fig 440): search, then green-edged cards with who wrote it, the stars, what they said and
 * when. Ratings come from clinics after completed visits (the clinic is rated from the visit itself).
 */
export default function MyReviews() {
  const [q, setQ] = useState('')
  const reviews = useQuery<{ average: number | null; count: number; items: { by: string; rating: number; text: string; date: string; recommend: boolean | null }[] }>({
    queryKey: ['my-reviews'], queryFn: () => api.get('/api/engage/reviews/mine'),
  })
  return (
    <Screen testID="my-reviews-screen" title="Reviews" back>
      <TextField testID="reviews-search" icon="search" value={q} onChangeText={setQ} placeholder="Search..." autoCapitalize="none" />
      <QueryState query={reviews}>
        {(data) => {
          const term = q.trim().toLowerCase()
          const items = data.items.filter((r) => !term || `${r.by} ${r.text}`.toLowerCase().includes(term))
          return (
            <>
              <T variant="h3" testID="reviews-average">{data.average ? `${data.average} ★ · ${data.count} review${data.count === 1 ? '' : 's'}` : 'No ratings yet'}</T>
              {items.length ? (
                <View style={{ gap: space.md }}>
                  {items.map((r, i) => (
                    <View key={i} testID={`review-${i}`} style={styles.card}>
                      <Text style={styles.name} numberOfLines={1}>{r.by}</Text>
                      <Text style={styles.stars} accessibilityLabel={`${Number(r.rating) || 0} of 5 stars`}>{'★'.repeat(Number(r.rating) || 0)}{'☆'.repeat(5 - (Number(r.rating) || 0))}</Text>
                      {!!(r.text || r.recommend) && <Text style={styles.line}>{r.text || 'Recommends you'}</Text>}
                      {!!r.date && <Text style={styles.line}>{fmtDate(r.date)}</Text>}
                    </View>
                  ))}
                </View>
              ) : <EmptyState icon="star" title={term ? 'No review matches' : 'No reviews yet'} message={term ? undefined : 'Clinics can rate you after a completed visit.'} />}
              <T variant="tiny" color={colors.textMuted}>Ratings come from clinics after completed visits.</T>
            </>
          )
        }}
      </QueryState>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { padding: space.md, gap: 2, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 6, borderLeftColor: stripeColors.done, ...shadow },
  name: { ...face('bold'), fontSize: 15, color: colors.textStrong },
  stars: { fontSize: 14, color: '#f5a623' },
  line: { ...face('regular'), fontSize: 13, color: colors.text },
})
