import { useQuery } from '@tanstack/react-query'
import { Share, StyleSheet, Text, View } from 'react-native'
import { api } from '../../api'
import { fmtDateTime } from '../../format'
import { colors, face, radius, space } from '../../theme'
import { ListRow, Screen, Section } from '../../ui/layout'
import { Banner, Button, T } from '../../ui/primitives'
import { QueryState } from '../../ui/states'

interface Wallet { code: string; points: number; tier: string; per_referral: number; transactions: { points: number; reason: string; at: string }[] }

/**
 * "Refer 'n' earn" and "wallet" (dentor.fig 307–311, 398–400): the referral code, points earned and the tier.
 * Online payments are excluded, so there is no money balance or top-up: the wallet holds points.
 */
export function WalletScreen({ appName }: { appName: string }) {
  const wallet = useQuery<Wallet>({ queryKey: ['engage', 'wallet'], queryFn: () => api.get('/api/engage/wallet') })
  return (
    <Screen testID="wallet-screen" title="Refer 'n' earn" back>
      <QueryState query={wallet}>
        {(w) => (
          <>
            <View style={styles.card}>
              <T variant="smallStrong" color="#ffffff">Points</T>
              <Text testID="wallet-points" style={styles.points}>{w.points} Pts</Text>
              <T variant="small" color="#ffffff">{w.tier} member</T>
            </View>
            <Section title="Refer your friend">
              <T color={colors.textMuted}>Earn {w.per_referral} points when a clinic or consultant you invite is approved on Dentor. They enter your code when they sign up.</T>
              <View style={styles.code}><Text testID="wallet-code" style={styles.codeText}>{w.code}</Text></View>
              <Button testID="wallet-share" label="Invite your friend" icon="share-2" full onPress={() =>
                Share.share({ message: `Join me on ${appName}. Use my referral code ${w.code} when you sign up.` }).catch(() => undefined)} />
            </Section>
            <Banner tone="blue" icon="info" text="Points will be redeemable at the Dentor store. Wallet top-ups are not available: payments are not taken in the app." />
            <Section title="Latest Transactions">
              {w.transactions.length ? w.transactions.map((t, i) => <ListRow key={i} title={`+${t.points} Pts`} subtitle={t.reason} meta={fmtDateTime(t.at)} />)
                : <T variant="small" color={colors.textMuted}>No points yet.</T>}
            </Section>
          </>
        )}
      </QueryState>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.header, gap: 4 },
  points: { ...face('bold', true), fontSize: 32, lineHeight: 40, color: '#fdc500' },
  code: { alignSelf: 'center', paddingHorizontal: space.xl, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.header },
  codeText: { ...face('bold'), fontSize: 22, letterSpacing: 2, color: colors.title },
})
