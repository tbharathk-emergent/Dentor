import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ApiError } from './api'
import { SessionProvider } from './session'
import { ToastProvider } from './ui/feedback'

/** Root providers every Dentor app needs: safe areas, data cache, toasts and the session. */
export function AppProviders<T>({
  storageKey,
  pick,
  children,
}: {
  storageKey: string
  pick: (payload: Record<string, any>, previous: T | null) => T
  children: ReactNode
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            // Retrying a 4xx never helps; one retry covers a flaky mobile connection.
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <SessionProvider<T> storageKey={storageKey} pick={pick}>
            {children}
          </SessionProvider>
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
