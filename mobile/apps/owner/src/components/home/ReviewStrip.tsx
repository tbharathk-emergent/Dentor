import { Avatar, api, colors, face, space } from '@dentor/shared'
import { useQuery } from '@tanstack/react-query'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

interface Review {
  id: string
  subject: string
  reviewer: string
  rating: number
  text: string
}

/**
 * Patients' approved reviews of the clinic's consultants (dentor.fig "Home" 37:626: a white strip of
 * cards with the consultant, the comment and the stars). Nothing is shown until there are some.
 */
export function ReviewStrip() {
  const reviews = useQuery({
    queryKey: ['clinic', 'home-reviews'],
    queryFn: () => api.get<{ items: Review[] }>('/api/reviews?type=Consultant&status=Approved&limit=6'),
  })
  const items = reviews.data?.items ?? []
  if (!items.length) return null
  return (
    <ScrollView testID="home-reviews" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((r) => (
        <View key={r.id} style={styles.card}>
          <View style={styles.head}>
            <Avatar name={r.subject} size={26} />
            <Text numberOfLines={1} style={styles.name}>{r.subject}</Text>
          </View>
          <Text numberOfLines={2} style={styles.text}>{r.text}</Text>
          <Text style={styles.stars}>{'★'.repeat(Math.round(r.rating))}<Text style={styles.off}>{'★'.repeat(5 - Math.round(r.rating))}</Text></Text>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: space.sm, padding: space.sm, borderRadius: 8, borderWidth: 1, borderColor: '#bdbcbc', backgroundColor: '#ffffff' },
  card: { width: 150, gap: 4, padding: space.sm, borderRadius: 8, borderWidth: 0.5, borderColor: '#bdbcbc' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontFamily: 'RadioCanada-Bold', fontSize: 10, color: '#000000' },
  text: { ...face('regular'), fontSize: 10, lineHeight: 14, color: '#000000' },
  stars: { fontSize: 12, color: '#f5b301' },
  off: { color: colors.border },
})
