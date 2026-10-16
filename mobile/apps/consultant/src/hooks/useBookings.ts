import { api } from '@dentor/shared'
import { useQuery } from '@tanstack/react-query'
import type { Booking } from '@/types'
import { keys } from './keys'

/** Referral bookings made for me through "Book a Consultant", newest first. */
export function useBookings() {
  return useQuery<{ items: Booking[] }>({ queryKey: keys.bookings, queryFn: () => api.get('/api/consultant/bookings') })
}
