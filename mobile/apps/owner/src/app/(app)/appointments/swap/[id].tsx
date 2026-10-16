import { Banner, ConfirmSheet, EmptyState, QueryState, Screen, T, colors, errorMessage, space, useLocalSearchParams, useToast } from '@dentor/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { useAppointment, useAppointments, useSwap } from '@/clinic/hooks'
import type { ClinicAppointment } from '@/clinic/types'
import { AppointmentCard } from '@/components/clinic/AppointmentCard'
import { useRouter } from '@/nav'

/** "TIME SWAP" (dentor.fig 2892:1358): two booked appointments of the same day exchange their times. */
export default function Swap() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const appointment = useAppointment(id)
  const sameDay = useAppointments('all', undefined, '', appointment.data?.date)
  const swap = useSwap()
  const [other, setOther] = useState<ClinicAppointment | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const confirm = () => {
    if (!other) return
    swap.mutate(
      { id, other_id: other.id },
      {
        onSuccess: () => {
          toast.success(`Swapped: ${appointment.data?.patient} now at ${other.time_label}, ${other.patient} at ${appointment.data?.time_label}.`)
          setOther(null)
          router.back()
        },
        onError: (e) => {
          setOther(null)
          setFailure(errorMessage(e))
        },
      },
    )
  }

  return (
    <Screen testID="swap-screen" title="Time Swap" back>
      <QueryState query={appointment}>
        {(a) => (
          <>
            <T variant="body" color={colors.text}>
              Swap {a.patient}'s {a.time_label} slot on {a.date_label} with another booked appointment that day.
            </T>
            {!!failure && <Banner testID="swap-error" tone="red" icon="alert-circle" text={failure} />}
            <QueryState query={sameDay}>
              {(list) => {
                const choices = list.items.filter((x) => x.id !== a.id && (x.status === 'Scheduled' || x.status === 'Waiting'))
                return choices.length ? (
                  <View style={{ gap: space.md }}>
                    {choices.map((x) => <AppointmentCard key={x.id} appointment={x} onPress={() => setOther(x)} />)}
                  </View>
                ) : (
                  <EmptyState testID="swap-empty" icon="repeat" title="Nothing to swap with" message="No other booked appointment on this day." />
                )
              }}
            </QueryState>
          </>
        )}
      </QueryState>
      <ConfirmSheet
        visible={!!other}
        onClose={() => setOther(null)}
        onConfirm={confirm}
        loading={swap.isPending}
        title="Swap these times?"
        message={other && appointment.data ? `${appointment.data.patient} moves to ${other.time_label} and ${other.patient} to ${appointment.data.time_label}. Both are told.` : ''}
        confirmLabel="Swap"
      />
    </Screen>
  )
}
