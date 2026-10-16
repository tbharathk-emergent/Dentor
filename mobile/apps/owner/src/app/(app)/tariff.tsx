import { EmptyState, Icon, QueryState, Screen, TextField, colors, face, fmtINR, radius, shadow, space } from '@dentor/shared'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTariff } from '@/clinic/clinical'

/**
 * "Treatment tariff" (dentor.fig 305–306): one folding section per speciality, its treatments listed as
 * "• Treatment — ₹price", from the clinic's treatment master. The first section starts open; a search
 * opens every section that has a match. The designs' promo banner and product strip are sample artwork.
 */
export default function Tariff() {
  const tariff = useTariff()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  return (
    <Screen testID="tariff-screen" title="Tariff" back>
      <TextField testID="tariff-search" icon="search" value={q} onChangeText={setQ} placeholder="Search a treatment" autoCapitalize="none" />
      <QueryState query={tariff}>
        {(data) => {
          const term = q.trim().toLowerCase()
          const current = open ?? data.groups[0]?.category ?? ''
          const groups = data.groups
            .map((g) => ({ ...g, items: g.items.filter((t) => !term || t.name.toLowerCase().includes(term)) }))
            .filter((g) => !term || g.items.length)
          if (!groups.length) return <EmptyState icon="search" title="No treatment matches" />
          return (
            <View style={{ gap: space.sm }}>
              {groups.map((g) => {
                const expanded = !!term || g.category === current
                return (
                  <View key={g.category} style={styles.section}>
                    <Pressable testID={`tariff-cat-${g.category}`} accessibilityRole="button" accessibilityState={{ expanded }}
                      accessibilityLabel={`${g.category}, ${g.items.length} treatments`}
                      onPress={() => setOpen(expanded && !term ? '' : g.category)} style={styles.head}>
                      <Text style={styles.headText} numberOfLines={1}>{g.category.toUpperCase()}</Text>
                      <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textStrong} />
                    </Pressable>
                    {expanded && (
                      <View style={styles.items}>
                        {g.items.map((t) => (
                          <View key={t.code} testID={`tariff-${t.code}`} style={styles.item}>
                            <Text style={styles.itemText}>• {t.name} — {fmtINR(t.price)}</Text>
                            {!!(t.duration || t.unit) && <Text style={styles.itemMeta}>{[t.duration ? `${t.duration} min` : '', t.unit].filter(Boolean).join(' · ')}</Text>}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          )
        }}
      </QueryState>
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: { borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow, overflow: 'hidden' },
  head: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, paddingHorizontal: space.lg, backgroundColor: '#f2f2f2' },
  headText: { flex: 1, fontFamily: 'JetBrainsMono-Regular', fontSize: 14, color: '#000000' },
  items: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm },
  item: { gap: 2 },
  itemText: { ...face('regular'), fontSize: 14, lineHeight: 20, color: colors.textStrong },
  itemMeta: { ...face('regular'), fontSize: 12, color: colors.textMuted, marginLeft: space.md },
})
