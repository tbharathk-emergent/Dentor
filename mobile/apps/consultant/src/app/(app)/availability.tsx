import { Banner, Button, Chip, MascotDialog, QueryState, Row, Screen, Section, Segmented, T, TextField, addDays, colors, errorMessage, space, todayISO } from '@dentor/shared'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import mascot from '@/assets/design/mascot-happy.png'
import { useAvailability, useSaveAvailability, type Availability } from '@/hooks/useRequests'
import { useRouter } from '@/nav'

const DAYS = [
  { key: 'mon', label: 'MON' }, { key: 'tue', label: 'TUE' }, { key: 'wed', label: 'WED' },
  { key: 'thu', label: 'THU' }, { key: 'fri', label: 'FRI' }, { key: 'sat', label: 'SAT' }, { key: 'sun', label: 'SUN' },
]
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * "Set Availability" (dentor.fig 3973:48456 default, 5792:7761 custom): weekly morning and evening hours,
 * and days with their own hours. Clinics can only book the half-hours set here.
 */
export default function AvailabilityScreen() {
  const router = useRouter()
  const current = useAvailability()
  const save = useSaveAvailability()
  const [mode, setMode] = useState<'default' | 'custom'>('default')
  const [weekly, setWeekly] = useState<Availability['weekly']>({})
  const [custom, setCustom] = useState<Availability['custom']>({})
  const [day, setDay] = useState(addDays(todayISO(), 1))
  const [from, setFrom] = useState('10:00')
  const [to, setTo] = useState('13:00')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const dates = useMemo(() => Array.from({ length: 30 }, (_, i) => addDays(todayISO(), i)), [])

  useEffect(() => {
    if (current.data) {
      setWeekly(current.data.weekly)
      setCustom(current.data.custom)
    }
  }, [current.data])

  const setPart = (d: string, part: 'morning' | 'evening', index: 0 | 1, value: string) =>
    setWeekly((w) => {
      const prev = w[d]?.[part] ?? (part === 'morning' ? ['09:00', '12:00'] : ['14:00', '18:00'])
      const next: [string, string] = index === 0 ? [value, prev[1]] : [prev[0], value]
      return { ...w, [d]: { ...w[d], [part]: next } }
    })
  const toggleDay = (d: string) =>
    setWeekly((w) => {
      const copy = { ...w }
      if (copy[d]) delete copy[d]
      else copy[d] = { morning: ['09:00', '12:00'], evening: ['14:00', '18:00'] }
      return copy
    })
  const togglePart = (d: string, part: 'morning' | 'evening') =>
    setWeekly((w) => {
      const parts = { ...w[d] }
      if (parts[part]) delete parts[part]
      else parts[part] = part === 'morning' ? ['09:00', '12:00'] : ['14:00', '18:00']
      return { ...w, [d]: parts }
    })

  const submit = () => {
    setError(null)
    for (const [d, parts] of Object.entries(weekly)) {
      for (const [part, range] of Object.entries(parts)) {
        if (!range || !HHMM.test(range[0]) || !HHMM.test(range[1]) || range[0] >= range[1]) return setError(`Check the ${part} hours on ${d.toUpperCase()}: use 24-hour times like 09:00, start before end.`)
      }
    }
    if (!agreed) return setError('Confirm that your hours are accurate and that you agree to the terms.')
    save.mutate({ weekly, custom, agreed }, { onSuccess: () => setSaved(true), onError: (e) => setError(errorMessage(e)) })
  }

  return (
    <Screen testID="availability-screen" title="Set Availability" back footer={<Button testID="availability-save" label="Submit" size="lg" full loading={save.isPending} onPress={submit} />}>
      <QueryState query={current}>
        {(data) => (
          <>
            {data.is_default && <Banner tone="blue" icon="info" text="You have not set your hours yet: clinics see Monday to Saturday, 9–12 and 2–6." />}
            <Segmented options={[{ key: 'default', label: 'Default' }, { key: 'custom', label: 'Custom' }]} value={mode} onChange={setMode} />
            {mode === 'default' ? (
              DAYS.map((d) => {
                const parts = weekly[d.key]
                return (
                  <Section key={d.key}>
                    <Row gap={space.sm}>
                      <Chip testID={`day-${d.key}`} label={d.label} selected={!!parts} onPress={() => toggleDay(d.key)} />
                      {!!parts && (['morning', 'evening'] as const).map((part) => (
                        <Chip key={part} testID={`${d.key}-${part}`} label={part === 'morning' ? 'Morning' : 'Evening'} selected={!!parts[part]} onPress={() => togglePart(d.key, part)} />
                      ))}
                    </Row>
                    {!!parts && (['morning', 'evening'] as const).filter((part) => parts[part]).map((part) => (
                      <Row key={part} gap={space.sm}>
                        <View style={{ flex: 1 }}><TextField testID={`${d.key}-${part}-from`} label={`${part === 'morning' ? 'Morning' : 'Evening'} from`} value={parts[part]![0]} onChangeText={(t) => setPart(d.key, part, 0, t)} maxLength={5} keyboardType="numbers-and-punctuation" /></View>
                        <View style={{ flex: 1 }}><TextField testID={`${d.key}-${part}-to`} label="To" value={parts[part]![1]} onChangeText={(t) => setPart(d.key, part, 1, t)} maxLength={5} keyboardType="numbers-and-punctuation" /></View>
                      </Row>
                    ))}
                  </Section>
                )
              })
            ) : (
              <Section title="Select Date">
                <Row wrap gap={space.xs}>{dates.map((d) => <Chip key={d} testID={`custom-${d}`} label={d.slice(5).split('-').reverse().join('/')} selected={d === day} onPress={() => setDay(d)} />)}</Row>
                <Row gap={space.sm}>
                  <View style={{ flex: 1 }}><TextField testID="custom-from" label="From" value={from} onChangeText={setFrom} maxLength={5} /></View>
                  <View style={{ flex: 1 }}><TextField testID="custom-to" label="To" value={to} onChangeText={setTo} maxLength={5} /></View>
                </Row>
                <Row gap={space.sm}>
                  <Button testID="custom-add" label="Set these hours" variant="secondary" onPress={() => {
                    if (!HHMM.test(from) || !HHMM.test(to) || from >= to) return setError('Use 24-hour times like 10:00, start before end.')
                    setError(null)
                    setCustom((c) => ({ ...c, [day]: [...(c[day] ?? []), [from, to]] }))
                  }} />
                  <Button testID="custom-off" label="Not available" variant="ghost" onPress={() => setCustom((c) => ({ ...c, [day]: [] }))} />
                </Row>
                {Object.entries(custom).sort().map(([d, ranges]) => (
                  <Row key={d} gap={space.sm}>
                    <T style={{ flex: 1 }}>{d}: {ranges.length ? ranges.map((r) => `${r[0]}–${r[1]}`).join(', ') : 'not available'}</T>
                    <Button label="Remove" size="sm" variant="ghost" onPress={() => setCustom((c) => { const copy = { ...c }; delete copy[d]; return copy })} />
                  </Row>
                ))}
              </Section>
            )}
            <Pressable testID="availability-agree" accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => setAgreed((a) => !a)} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
              <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.header, backgroundColor: agreed ? colors.header : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {agreed && <Text style={{ color: '#ffffff', fontSize: 12 }}>✓</Text>}
              </View>
              <T variant="small" style={{ flex: 1 }}>I confirm that my set hours are accurate and I agree to the Terms and conditions.</T>
            </Pressable>
            {!!error && <Banner testID="availability-error" tone="red" icon="alert-circle" text={error} />}
          </>
        )}
      </QueryState>
      <MascotDialog
        testID="availability-saved"
        visible={saved}
        image={mascot}
        title="Schedule updated"
        message="Your practice schedule is saved. Clinics can now book the times you set. You can change it here later."
        actions={[{ label: 'OK', testID: 'availability-ok', onPress: () => { setSaved(false); router.back() } }]}
      />
    </Screen>
  )
}
