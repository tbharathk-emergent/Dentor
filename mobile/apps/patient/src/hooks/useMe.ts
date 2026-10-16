import { api, useSession } from '@dentor/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PATIENT_API } from '@/endpoints'
import { keys } from '@/hooks/keys'
import { usePatientQuery } from '@/hooks/usePatientQuery'
import type { MeData, PatientProfile, PatientSession, ProfileChanges } from '@/types'

/** The account, the patient record at the active clinic, and that clinic's contact details. */
export function useMe() {
  return usePatientQuery<MeData>({ queryKey: keys.me, queryFn: () => api.get(`${PATIENT_API}/me`) })
}

/** Saves profile changes and keeps the cached profile and the stored session in step. */
export function useUpdateProfile() {
  const qc = useQueryClient()
  const { data: session, update } = useSession<PatientSession>()
  return useMutation({
    mutationFn: (changes: ProfileChanges) => api.patch<PatientProfile>(`${PATIENT_API}/me`, changes),
    onSuccess: async (profile) => {
      qc.setQueriesData<MeData>({ queryKey: keys.me }, (current) => (current ? { ...current, profile } : current))
      void qc.invalidateQueries({ queryKey: keys.home })
      void qc.invalidateQueries({ queryKey: keys.profiles })
      if (!session?.profile) return
      const active = { ...session.profile, name: profile.name, age: profile.age, gender: profile.gender }
      await update({
        profile: active,
        profiles: session.profiles.map((p) => (p.patient_id === active.patient_id && p.clinic_id === active.clinic_id ? active : p)),
      })
    },
  })
}
