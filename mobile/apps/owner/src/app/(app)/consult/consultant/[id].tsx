import { Avatar, Card, KeyValue, ListRow, QueryState, Row, Screen, Section, T, Badge, colors, fmtINR, space, useLocalSearchParams } from '@dentor/shared'
import { View } from 'react-native'
import { useConsultantProfile } from '@/clinic/consult'

/** "Consultant Profile" (dentor.fig 2664:840): services offered, about, experience and recent reviews. */
export default function ConsultantProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const profile = useConsultantProfile(id)
  return (
    <Screen testID="consultant-profile-screen" title="Consultant Profile" back>
      <QueryState query={profile}>
        {(c) => (
          <>
            <View style={{ alignItems: 'center', gap: space.xs }}>
              <Avatar name={c.name} size={84} />
              <T variant="h3">{c.name}</T>
              <T variant="small" color={colors.textMuted}>{[c.credentials, c.specialty].filter(Boolean).join(' · ')}</T>
            </View>
            <Card>
              <KeyValue label="Experience" value={c.experience ? `${c.experience}+ years` : ''} />
              <KeyValue label="Location" value={c.location} />
              <KeyValue label="Consultation fee" value={c.fee ? fmtINR(c.fee) : ''} />
              <KeyValue label="Rating" value={c.rating ? `${c.rating} / 5` : ''} />
            </Card>
            <Section title="Service Offered">
              <Row wrap gap={space.sm}>{c.services.map((s) => <Badge key={s} label={s} tone="brand" />)}</Row>
            </Section>
            {!!c.about && <Section title="About"><T>{c.about}</T></Section>}
            <Section title="Recent Reviews">
              {c.reviews.length ? c.reviews.map((r, i) => <ListRow key={i} title={`${r.rating ? `${r.rating}★ ` : ''}${r.by}`} subtitle={r.text} />) : <T variant="small" color={colors.textMuted}>No reviews yet.</T>}
            </Section>
          </>
        )}
      </QueryState>
    </Screen>
  )
}
