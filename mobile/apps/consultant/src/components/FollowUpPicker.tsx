import { addDays, space } from '@dentor/shared'
import { View } from 'react-native'
import { addMonths } from '@/lib/dates'
import { ChipGroup } from './ChipGroup'
import { DateField } from './DateField'

const QUICK = [
  { value: '3-days', label: '+3 days', from: (today: string) => addDays(today, 3) },
  { value: '1-week', label: '+1 week', from: (today: string) => addDays(today, 7) },
  { value: '2-weeks', label: '+2 weeks', from: (today: string) => addDays(today, 14) },
  { value: '1-month', label: '+1 month', from: (today: string) => addMonths(today, 1) },
] as const

/** Optional follow-up date: one tap for the usual intervals, a calendar for anything else. */
export function FollowUpPicker({ value, onChange, today, error }: { value: string; onChange: (date: string) => void; today: string; error?: string }) {
  const active = QUICK.find((q) => q.from(today) === value)?.value ?? ''
  return (
    <View style={{ gap: space.md }}>
      <DateField testID="rx-followup-date" label="Follow-up date" value={value} onChange={onChange} today={today} minDate={today} placeholder="No follow-up" clearable error={error} />
      <ChipGroup
        testID="rx-followup"
        options={QUICK.map(({ value: v, label }) => ({ value: v, label }))}
        value={active}
        // Tapping the chosen interval again removes the follow-up.
        onChange={(picked) => onChange(picked === active ? '' : QUICK.find((q) => q.value === picked)!.from(today))}
      />
    </View>
  )
}
