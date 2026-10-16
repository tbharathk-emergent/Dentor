import { api } from '@dentor/shared'
import { useMutation } from '@tanstack/react-query'
import { PATIENT_API } from '@/endpoints'

/** Removes the app login (clinic records stay with the clinic). Sign out after it succeeds. */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (password: string) => api.post<{ ok: boolean }>(`${PATIENT_API}/account/delete`, { password }),
  })
}
