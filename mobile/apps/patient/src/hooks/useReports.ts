import { api } from '@dentor/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PATIENT_API } from '@/endpoints'
import { keys } from '@/hooks/keys'
import { usePatientQuery } from '@/hooks/usePatientQuery'
import type { ReportContent, ReportFile } from '@/types'

/** The list carries no file content; a file is downloaded when it is opened. */
export function useReports() {
  return usePatientQuery<{ items: ReportFile[] }>({ queryKey: keys.reports, queryFn: () => api.get(`${PATIENT_API}/reports`) })
}

export function useReport(id: string) {
  return usePatientQuery<ReportContent>({
    queryKey: keys.report(id),
    queryFn: () => api.get(`${PATIENT_API}/reports/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  })
}

export function useUploadReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: { name: string; dataUrl: string; size: number }) =>
      api.post<{ id: string; name: string }>(`${PATIENT_API}/reports`, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.reports }),
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`${PATIENT_API}/reports/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.reports }),
  })
}
