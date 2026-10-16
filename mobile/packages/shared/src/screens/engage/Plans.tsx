import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api, errorMessage } from '../../api'
import { colors, face, radius, space } from '../../theme'
import { useToast } from '../../ui/feedback'
import { Screen } from '../../ui/layout'
import { Banner, Icon, T } from '../../ui/primitives'
import { QueryState } from '../../ui/states'

interface Plan { key: string; name: string; price: number; days: number; cases: number; benefits: string[]; best?: boolean }

// The designs colour each plan (dentor.fig 312–315, 406–408): ELITE green, ELITE PRO blue, ELITE PREMIUM pink.
const PLAN_COLOURS: Record<string, string> = { elite: '#8dc63f', elite_pro: '#29abe2', elite_premium: '#ec1e79' }
const DARK = '#1c1c1c'
const CHECK = '#ffc20e'
const rupees = (n: number) => `₹ ${n.toLocaleString('en-IN')}/-`

/**
 * "subscription" ELITE, ELITE PRO, ELITE PREMIUM (dentor.fig 312–315, 406–408): one plan card at a time with
 * arrows, the name on a coloured tag, the price, what it includes, "BEGIN JOURNEY", and two notes. Buying in
 * the app is excluded: "Begin Journey" sends Dentor a request and they activate the plan. The designs' discount
 * percentages are not shown: they differ between the files and wait for Dentor's decision (D19).
 */
export function PlansScreen() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const plans = useQuery<{ plans: Plan[]; current: string; pending_request: boolean }>({ queryKey: ['engage', 'plans'], queryFn: () => api.get('/api/engage/plans') })
  const request = useMutation({ mutationFn: (plan: string) => api.post('/api/engage/plans/request', { plan }) })
  const [index, setIndex] = useState<number | null>(null)
  const [note, setNote] = useState<'what' | 'how' | null>(null)
  return (
    <Screen testID="plans-screen" title="Subscription" back>
      <QueryState query={plans}>
        {(data) => {
          const list = data.plans
          const at = index ?? Math.max(0, list.findIndex((p) => p.best))
          const p = list[at]
          if (!p) return null
          const tone = PLAN_COLOURS[p.key] ?? colors.header
          const send = () => request.mutate(p.key, {
            onSuccess: () => { toast.success(`Request for ${p.name} sent to Dentor.`); void queryClient.invalidateQueries({ queryKey: ['engage'] }) },
            onError: (e) => toast.error(new Error(errorMessage(e))),
          })
          const locked = data.pending_request || (request.isPending && request.variables === p.key)
          return (
            <>
              {!!data.current && <T variant="small" color={colors.textMuted}>Current plan: {data.current}</T>}
              {data.pending_request && <Banner testID="plan-pending" tone="amber" icon="clock" text="Your plan request is with Dentor. They will contact you to activate it." />}
              <View style={styles.stage}>
                <Arrow testID="plan-prev" icon="chevron-left" label="Previous plan" hidden={at === 0} onPress={() => setIndex(at - 1)} />
                <View testID={`plan-${p.key}`} style={styles.card} accessibilityLabel={`${p.name}, ${rupees(p.price)}`}>
                  <View style={[styles.tag, { backgroundColor: tone }]}>
                    <Text style={styles.tagName}>{p.name}</Text>
                    <Text style={styles.tagPrice} numberOfLines={1} adjustsFontSizeToFit>{rupees(p.price)}</Text>
                    {p.best && <View style={styles.ribbon}><Text style={styles.ribbonText}>BEST DEAL</Text></View>}
                  </View>
                  <View style={styles.body}>
                    {[...p.benefits.filter((b) => !/cases applicable|days validity/i.test(b)), `${p.days} Days Validity`, `${p.cases} cases Applicable`].map((b) => (
                      <View key={b} style={styles.benefit}>
                        <Icon name="check-square" size={20} color={CHECK} />
                        <Text style={styles.benefitText}>{b}</Text>
                      </View>
                    ))}
                  </View>
                  <Pressable testID={`plan-request-${p.key}`} accessibilityRole="button" accessibilityLabel={`Begin journey with ${p.name}`}
                    accessibilityState={{ disabled: locked }} disabled={locked} onPress={send} style={[styles.begin, { backgroundColor: tone }, locked && { opacity: 0.6 }]}>
                    <Text style={styles.beginText}>{request.isPending && request.variables === p.key ? 'SENDING…' : 'BEGIN JOURNEY'}</Text>
                  </Pressable>
                </View>
                <Arrow testID="plan-next" icon="chevron-right" label="Next plan" hidden={at >= list.length - 1} onPress={() => setIndex(at + 1)} />
              </View>
              <Text style={styles.dots} accessibilityLabel={`Plan ${at + 1} of ${list.length}`}>{list.map((_, i) => (i === at ? '●' : '○')).join('  ')}</Text>
              <Fold testID="plan-what" title="What Is Premium Membership ?" open={note === 'what'} onPress={() => setNote(note === 'what' ? null : 'what')}
                text="Premia Membership is a privilege offered to dentists who use the Dentor app: members get the plan's benefits for their practice." />
              <Fold testID="plan-how" title="How it works ?" open={note === 'how'} onPress={() => setNote(note === 'how' ? null : 'how')}
                text="Choose a plan and tap Begin Journey. Dentor receives your request, contacts you and activates the plan. Payment is not taken in the app." />
            </>
          )
        }}
      </QueryState>
    </Screen>
  )
}

function Arrow({ testID, icon, label, hidden, onPress }: { testID: string; icon: 'chevron-left' | 'chevron-right'; label: string; hidden: boolean; onPress: () => void }) {
  if (hidden) return <View style={styles.arrow} />
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={styles.arrow}>
      <Icon name={icon} size={34} color={colors.header} />
    </Pressable>
  )
}

function Fold({ testID, title, text, open, onPress }: { testID: string; title: string; text: string; open: boolean; onPress: () => void }) {
  return (
    <View style={styles.fold}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onPress} style={styles.foldHead}>
        <Text style={styles.foldTitle}>{title}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textStrong} />
      </Pressable>
      {open && <Text style={styles.foldText}>{text}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  stage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  arrow: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  card: { flex: 1, maxWidth: 280, borderRadius: radius.lg, backgroundColor: DARK, overflow: 'visible', marginTop: space.xxl },
  tag: { marginHorizontal: space.lg, marginTop: -space.xxl, borderRadius: radius.lg, paddingVertical: space.md, paddingHorizontal: space.sm, alignItems: 'center', gap: 2 },
  tagName: { fontFamily: 'Gabriela-Regular', fontSize: 18, color: '#ffffff' },
  tagPrice: { ...face('bold'), fontSize: 26, color: '#ffffff' },
  ribbon: { position: 'absolute', top: 6, right: -10, backgroundColor: CHECK, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, transform: [{ rotate: '35deg' }] },
  ribbonText: { ...face('bold'), fontSize: 9, color: '#000000' },
  body: { paddingHorizontal: space.lg, paddingVertical: space.lg, gap: space.sm },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  benefitText: { ...face('regular'), fontSize: 15, color: CHECK, flexShrink: 1 },
  begin: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  beginText: { ...face('bold'), fontSize: 16, color: '#ffffff', letterSpacing: 0.5 },
  dots: { textAlign: 'center', color: colors.textMuted, fontSize: 12 },
  fold: { borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  foldHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  foldTitle: { ...face('semibold'), fontSize: 15, color: colors.textStrong, flex: 1 },
  foldText: { ...face('regular'), fontSize: 13, lineHeight: 19, color: colors.text, paddingHorizontal: space.md, paddingBottom: space.md },
})
