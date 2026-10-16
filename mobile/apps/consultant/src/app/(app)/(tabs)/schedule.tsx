import { addDays, EmptyState, QueryState, Screen, Section, space, todayISO } from '@dentor/shared'
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { AppointmentCard } from '@/components/AppointmentCard'
import { BookingRow } from '@/components/BookingRow'
import { DayStrip } from '@/components/DayStrip'
import { ListCard } from '@/components/ListCard'
import { useDayAppointments, useRangeAppointments } from '@/hooks/useAppointments'
import { useBookings } from '@/hooks/useBookings'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus'
import { longDate, shortDate, startOfWeek } from '@/lib/dates'
import { useRouter } from '@/nav'

export default function Schedule() {
  const router = useRouter()
  const today = todayISO()
  // The strip shows this week and the next; paging moves it a week at a time.
  const [start, setStart] = useState(() => startOfWeek(today))
  const [selected, setSelected] = useState(today)

  const day = useDayAppointments(selected)
  const span = useRangeAppointments(start, addDays(start, 13))
  const bookings = useBookings()
  const reload = () => Promise.all([day.refetch(), span.refetch(), bookings.refetch()])
  useRefetchOnFocus(reload)
  const pull = usePullToRefresh(reload)

  // Appointments per day, for the markers on the strip.
  const counts = useMemo(() => {
    const perDay: Record<string, number> = {}
    for (const a of span.data?.items ?? []) perDay[a.date] = (perDay[a.date] ?? 0) + 1
    return perDay
  }, [span.data])

  const shiftWeek = (weeks: -1 | 1) => {
    setStart((s) => addDays(s, weeks * 7))
    setSelected((s) => addDays(s, weeks * 7))
  }
  const goToday = () => {
    setStart(startOfWeek(today))
    setSelected(today)
  }

  return (
    <Screen
      testID="screen-schedule"
      title="Schedule"
      subtitle={longDate(selected)}
      {...pull}
    >
      <DayStrip start={start} selected={selected} today={today} counts={counts} onSelect={setSelected} onShiftWeek={shiftWeek} onToday={goToday} />

      <Section title={selected === today ? 'Today' : shortDate(selected)}>
        <QueryState query={day}>
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState testID="day-empty" icon="calendar" title="Nothing booked" message={`No appointments with you on ${longDate(selected)}.`} />
            ) : (
              <View testID="day-list" style={{ gap: space.md }}>
                {data.items.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    testID={`day-appt-${a.id}`}
                    appointment={a}
                    onPress={() => router.push({ pathname: '/appointments/[id]', params: { id: a.id } })}
                  />
                ))}
              </View>
            )
          }
        </QueryState>
      </Section>

      <Section title="Referral bookings">
        <QueryState query={bookings}>
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState
                testID="bookings-empty"
                icon="user-plus"
                title="No referral bookings"
                message="Patients referred to you through the clinic's Book a Consultant desk appear here."
              />
            ) : (
              <ListCard testID="bookings-list">
                {data.items.map((b) => (
                  <BookingRow key={b.id} booking={b} />
                ))}
              </ListCard>
            )
          }
        </QueryState>
      </Section>
    </Screen>
  )
}
