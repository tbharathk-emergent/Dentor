import { Chip, Icon, T, colors, space } from '@dentor/shared'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { usePeriod } from '@/hooks/usePeriod'
import { PERIODS } from '@/lib/period'

/**
 * Period chips plus the chosen dates in words. The chips share each row equally and wrap, so
 * all four are always on screen: two rows on a phone, one on a tablet.
 * `scope` keeps testIDs unique per screen (tabs stay mounted side by side); `updating` shows
 * that figures for the new period are loading.
 */
export function PeriodControl({ scope, updating }: { scope: string; updating?: boolean }) {
  const period = usePeriod()
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.chips}>
        {PERIODS.map((option) => (
          <View key={option.key} style={styles.cell}>
            <Chip
              testID={`${scope}-period-${option.key}`}
              label={option.label}
              selected={option.key === period.key}
              onPress={() => period.setPeriod(option.key)}
            />
          </View>
        ))}
      </View>
      <View style={styles.summary}>
        <Icon name="calendar" size={14} />
        <T variant="smallStrong" color={colors.textMuted} testID={`${scope}-period-label`} style={{ flexShrink: 1 }}>
          {period.label}
        </T>
        {updating ? <ActivityIndicator testID={`${scope}-period-updating`} size="small" color={colors.brand700} /> : null}
      </View>
    </View>
  )
}

/** Wide enough for the longest label; rows hold as many chips as fit at this width. */
const CHIP_MIN_WIDTH = 132

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { flexGrow: 1, flexBasis: CHIP_MIN_WIDTH },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 },
})
