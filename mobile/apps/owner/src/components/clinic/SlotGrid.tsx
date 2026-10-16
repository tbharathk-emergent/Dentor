import { T, TOUCH, colors, fmtTime, radius, space } from '@dentor/shared'
import { Pressable, StyleSheet, View } from 'react-native'
import type { DaySlot } from '@/clinic/types'

/** The day's half-hour slots, three to a row; taken and past ones are shown struck through. */
export function SlotGrid({ slots, value, onChange }: { slots: DaySlot[]; value: string; onChange: (time: string) => void }) {
  return (
    <View testID="time-slots" style={styles.grid}>
      {slots.map((slot) => {
        const on = slot.time === value
        const label = fmtTime(slot.time)
        return (
          <Pressable
            key={slot.time}
            testID={`slot-${slot.time}`}
            accessibilityRole="button"
            accessibilityLabel={slot.available ? label : `${label}, not available`}
            accessibilityState={{ selected: on, disabled: !slot.available }}
            disabled={!slot.available}
            onPress={() => onChange(slot.time)}
            style={[styles.slot, on && styles.slotOn, !slot.available && styles.slotOff]}
          >
            <T variant="smallStrong" color={on ? '#ffffff' : slot.available ? colors.text : colors.textFaint} style={!slot.available && styles.struck}>
              {label}
            </T>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: {
    flexBasis: '30%', flexGrow: 1, maxWidth: '33%', minHeight: TOUCH, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface,
  },
  slotOn: { backgroundColor: colors.header, borderColor: colors.header },
  slotOff: { backgroundColor: colors.slateBg, borderColor: colors.border },
  struck: { textDecorationLine: 'line-through' },
})
