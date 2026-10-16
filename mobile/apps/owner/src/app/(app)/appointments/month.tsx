import { EmptyState, IconButton, QueryState, Screen, Section, T, colors, face, radius, space } from '@dentor/shared'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAppointments, useMonth } from '@/clinic/hooks'
import { AppointmentCard } from '@/components/clinic/AppointmentCard'
import { useRouter } from '@/nav'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const shift = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** "monthly" (dentor.fig 7970:4247): the month with the number booked each day; a day opens its list. */
export default function MonthScreen() {
  const router = useRouter()

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [day, setDay] = useState<string | null>(null)
  const view = useMonth(month)
  const dayList = useAppointments('all', undefined, '', day ?? undefined)

  return (
    <Screen testID="month-screen" title="Monthly" back>
      <View style={styles.head}>
        <IconButton testID="month-prev" icon="chevron-left" label="Previous month" onPress={() => { setMonth(shift(month, -1)); setDay(null) }} />
        <Text testID="month-label" style={styles.title}>{MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</Text>
        <IconButton testID="month-next" icon="chevron-right" label="Next month" onPress={() => { setMonth(shift(month, 1)); setDay(null) }} />
      </View>
      <QueryState query={view}>
        {(data) => {
          const first = new Date(`${data.first}T00:00:00`)
          const lead = (first.getDay() + 6) % 7
          const total = Number(data.last.slice(8))
          const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)]
          while (cells.length % 7) cells.push(null)
          return (
            <View style={styles.grid}>
              {DOW.map((d) => <Text key={d} style={styles.dow}>{d}</Text>)}
              {cells.map((iso, i) => {
                const count = iso ? data.days[iso] ?? 0 : 0
                const on = !!iso && iso === day
                return (
                  <Pressable
                    key={i}
                    testID={iso ? `day-${iso}` : undefined}
                    disabled={!iso}
                    accessibilityRole="button"
                    accessibilityLabel={iso ? `${iso}, ${count} appointments` : undefined}
                    onPress={() => iso && setDay(iso)}
                    style={[styles.cell, iso === data.today && styles.today, on && styles.on]}
                  >
                    {iso && <Text style={[styles.num, on && { color: '#ffffff' }]}>{Number(iso.slice(8))}</Text>}
                    {count > 0 && <View style={[styles.dot, on && { backgroundColor: '#ffffff' }]}><Text style={[styles.dotText, on && { color: colors.header }]}>{count}</Text></View>}
                  </Pressable>
                )
              })}
            </View>
          )
        }}
      </QueryState>
      {day && (
        <Section title={`On ${day.slice(8)} ${MONTHS[Number(day.slice(5, 7)) - 1]}`}>
          <QueryState query={dayList}>
            {(list) =>
              list.items.length ? (
                <View style={{ gap: space.md }}>
                  {list.items.map((a) => <AppointmentCard key={a.id} appointment={a} onPress={() => router.push({ pathname: '/appointments/[id]', params: { id: a.id } })} />)}
                </View>
              ) : (
                <EmptyState icon="calendar" title="Nothing booked" />
              )
            }
          </QueryState>
        </Section>
      )}
      {!day && <T variant="small" color={colors.textMuted}>Tap a day to see its appointments.</T>}
    </Screen>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...face('semibold', true), fontSize: 18, color: colors.textStrong },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.xs },
  dow: { width: `${100 / 7}%`, textAlign: 'center', ...face('medium'), fontSize: 12, color: colors.textMuted },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, gap: 2 },
  today: { borderWidth: 1, borderColor: colors.header },
  on: { backgroundColor: colors.header },
  num: { ...face('medium'), fontSize: 14, color: colors.text },
  dot: { minWidth: 18, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' },
  dotText: { ...face('bold'), fontSize: 10, color: '#ffffff' },
})
