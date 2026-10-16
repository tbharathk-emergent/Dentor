import { api } from '@dentor/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PATIENT_API } from '@/endpoints'
import { keys } from '@/hooks/keys'
import { usePatientQuery } from '@/hooks/usePatientQuery'
import type { ChatData, ChatMessage } from '@/types'

const POLL_MS = 15_000

/** The thread with the clinic's front desk. Polls while `active` (the screen is in front). */
export function useChat(active: boolean) {
  return usePatientQuery<ChatData>({
    queryKey: keys.chat,
    queryFn: () => api.get(`${PATIENT_API}/chat`),
    refetchInterval: active ? POLL_MS : false,
    staleTime: 0,
  })
}

/** Shows the message at once, then replaces the thread with the server's copy — or takes it back. */
export function useSendMessage() {
  const qc = useQueryClient()
  const thread = { queryKey: keys.chat }
  return useMutation({
    mutationFn: (text: string) => api.post<{ messages: ChatMessage[] }>(`${PATIENT_API}/chat`, { text }),
    onMutate: async (text) => {
      await qc.cancelQueries(thread)
      const previous = qc.getQueriesData<ChatData>(thread)
      const sending: ChatMessage = { mine: true, text, time: '', at: new Date().toISOString(), pending: true }
      qc.setQueriesData<ChatData>(thread, (current) => current && { ...current, messages: [...current.messages, sending] })
      return { previous }
    },
    onError: (_error, _text, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: (result) => {
      qc.setQueriesData<ChatData>(thread, (current) => current && { ...current, messages: result.messages })
      // Covers a thread that had not loaded when the message was sent.
      void qc.invalidateQueries({ ...thread, predicate: (query) => query.state.data === undefined })
    },
  })
}
