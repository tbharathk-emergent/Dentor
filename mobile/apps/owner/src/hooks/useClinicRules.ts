import { api } from '@dentor/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RuleKey } from '@/lib/rules'
import type { ClinicSettings } from '@/types'

const settingsKey = ['clinic', 'settings'] as const

export function useClinicSettings() {
  return useQuery<ClinicSettings>({
    queryKey: settingsKey,
    queryFn: () => api.get<ClinicSettings>('/api/settings'),
  })
}

/**
 * Turns one rule on or off. The switch moves at once and moves back if the save fails.
 * Only this rule is sent, so a setting someone else changed a moment ago is not overwritten.
 */
export function useSetClinicRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: RuleKey; value: boolean }) => {
      const saved = await api.patch<{ values: ClinicSettings }>('/api/settings', { values: { [key]: value } })
      return saved.values
    },
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey: settingsKey })
      const previous = queryClient.getQueryData<ClinicSettings>(settingsKey)
      queryClient.setQueryData<ClinicSettings>(settingsKey, { ...previous, [key]: value })
      return { previous }
    },
    onSuccess: (values) => {
      queryClient.setQueryData<ClinicSettings>(settingsKey, values)
    },
    onError: (_error, _change, context) => {
      queryClient.setQueryData<ClinicSettings>(settingsKey, context?.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKey }),
  })
}
