import { api, qs } from '@dentor/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PATIENT_API } from '@/endpoints'
import { keys } from '@/hooks/keys'
import { usePatientQuery } from '@/hooks/usePatientQuery'
import type { AuthPayload, ClinicListing, FamilyMemberRequest, Profile } from '@/types'

/** Every patient record registered on this mobile number, across clinics. */
export function useProfiles() {
  return usePatientQuery<{ items: Profile[] }>({ queryKey: keys.profiles, queryFn: () => api.get(`${PATIENT_API}/profiles`) })
}

/** Answers with a session pinned to the chosen profile; pass it to `signIn()`. */
export function useSelectProfile() {
  return useMutation({
    mutationFn: (profile: Pick<Profile, 'patient_id' | 'clinic_id'>) =>
      api.post<AuthPayload>(`${PATIENT_API}/profiles/select`, { patient_id: profile.patient_id, clinic_id: profile.clinic_id }),
  })
}

export function useAddFamilyMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: FamilyMemberRequest) =>
      api.post<{ profile: Pick<Profile, 'patient_id' | 'clinic_id' | 'name' | 'code'> }>(`${PATIENT_API}/profiles/family`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.profiles }),
  })
}

/** Clinics that accept registrations from the app, filtered by name, city or code. */
export function useClinicDirectory(search: string) {
  return usePatientQuery<{ items: ClinicListing[] }>({
    queryKey: keys.clinicSearch(search),
    queryFn: () => api.get(`${PATIENT_API}/clinics${qs({ q: search })}`),
    placeholderData: (previous) => previous,
  })
}

/** Registers the account with a clinic; answers with a session pinned to the new profile. */
export function useJoinClinic() {
  return useMutation({
    mutationFn: (body: { clinic_id: string; name?: string; age?: number; gender?: string }) =>
      api.post<AuthPayload>(`${PATIENT_API}/profiles/join`, body),
  })
}
