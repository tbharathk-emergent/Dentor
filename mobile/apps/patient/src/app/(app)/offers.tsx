import { api, Button, EmptyState, QueryState, Screen, T, colors, radius, space } from '@dentor/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { StyleSheet, View } from 'react-native'
import { useRouter } from '@/nav'

interface Offer { id: string; title: string; treatment: string; category: string; discount: string; valid_label: string }

/** "Offers" from the clinic (sent from the Clinic app): open one to book with it; viewing is counted for the clinic. */
export default function Offers() {
  const router = useRouter()
  const offers = useQuery<{ items: Offer[] }>({ queryKey: ['offers'], queryFn: () => api.get('/api/patient/offers') })
  const view = useMutation({ mutationFn: (id: string) => api.post(`/api/patient/offers/${id}/view`) })
  return (
    <Screen testID="offers-screen" title="Offers" back>
      <QueryState query={offers}>
        {(data) => data.items.length ? (
          <View style={{ gap: space.md }}>
            {data.items.map((o) => (
              <View key={o.id} testID={`offer-${o.id}`} style={styles.card}>
                <T variant="h3" color={colors.title}>{o.discount}</T>
                <T variant="bodyStrong">{o.title}</T>
                {!!o.treatment && <T variant="small" color={colors.textMuted}>On {o.treatment}</T>}
                <T variant="tiny" color={colors.textMuted}>Valid till {o.valid_label}</T>
                <Button testID={`offer-book-${o.id}`} label="Apply and book" size="sm" onPress={() => {
                  view.mutate(o.id)
                  router.push({ pathname: '/book', params: { offer: o.id, offerTitle: `${o.title} (${o.discount})`, treatment: o.treatment } })
                }} />
              </View>
            ))}
            <T variant="tiny" color={colors.textMuted}>The clinic applies the offer when you pay at the clinic.</T>
          </View>
        ) : <EmptyState testID="offers-empty" icon="gift" title="No offers right now" message="Your clinic's offers appear here." />}
      </QueryState>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.xs, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
})
