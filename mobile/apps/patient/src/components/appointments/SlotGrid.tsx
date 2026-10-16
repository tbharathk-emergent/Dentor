import { T, TOUCH, colors, radius, space } from '@dentor/shared'
import { Pressable, StyleSheet, View } from 'react-native'
import type { Slot } from '@/types'

/** The day's time slots, three to a row; taken or past slots are shown but cannot be chosen. */
export function SlotGrid({ slots, value, onChange }: { slots: Slot[]; value: string; onChange: (time: string) => void }) {
  return (
    <View testID="time-slots" style={styles.grid}>
      {slots.map((slot) => {
        const on = slot.time === value
        return (
          <Pressable
            key={slot.time}
            testID={`slot-${slot.time}`}
            accessibilityRole="button"
            accessibilityLabel={slot.available ? slot.label : `${slot.label}, not available`}
            accessibilityState={{ selected: on, disabled: !slot.available }}
            disabled={!slot.available}
            onPress={() => onChange(slot.time)}
            style={[styles.slot, on && styles.slotOn, !slot.available && styles.slotOff]}
          >
            <T
              variant="smallStrong"
              color={on ? colors.onBrand : slot.available ? colors.text : colors.textFaint}
              style={!slot.available && styles.struck}
            >
              {slot.label}
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
  slotOn: { backgroundColor: colors.brand700, borderColor: colors.brand700 },
  slotOff: { backgroundColor: colors.slateBg, borderColor: colors.border },
  struck: { textDecorationLine: 'line-through' },
})
