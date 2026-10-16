import { api } from '@dentor/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PATIENT_API } from '@/endpoints'
import { keys } from '@/hooks/keys'
import { usePatientQuery } from '@/hooks/usePatientQuery'
import type { Review, ReviewRequest } from '@/types'

/** Reviews this patient wrote in the app, newest first. */
export function useReviews() {
  return usePatientQuery<{ items: Review[] }>({ queryKey: keys.reviews, queryFn: () => api.get(`${PATIENT_API}/reviews`) })
}

export function useSubmitReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ReviewRequest) => api.post<Review>(`${PATIENT_API}/reviews`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.reviews }),
  })
}
