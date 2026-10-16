/**
 * Signed-in session for one app: tokens + the app's own session data (the user, or the
 * patient account and active profile). Persisted in the device keychain, restored on launch,
 * kept in step with token rotation, and cleared when the API says the session is over.
 */
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, bindSession, getTokens, setTokens, type Tokens } from './api'
import { loadItem, removeItem, saveItem } from './storage'

type Status = 'loading' | 'signedOut' | 'signedIn'
type AuthPayload = Tokens & Record<string, any>

interface SessionValue<T> {
  status: Status
  data: T | null
  /**
   * Store a successful sign-in / sign-up / profile-switch response. With `remember: false`
   * (the login screen's "Remember me" unticked) the session lives only until the app closes.
   */
  signIn: (payload: AuthPayload, options?: { remember?: boolean }) => Promise<void>
  signOut: () => Promise<void>
  /** Update the stored session data (e.g. after editing the profile). */
  update: (patch: Partial<T>) => Promise<void>
}

const Ctx = createContext<SessionValue<any> | null>(null)

export function useSession<T = Record<string, any>>(): SessionValue<T> {
  const value = useContext(Ctx)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>')
  return value as SessionValue<T>
}

export function SessionProvider<T>({
  storageKey,
  pick,
  children,
}: {
  /** Unique per app, e.g. "dentor.patient.session". */
  storageKey: string
  /** Extracts this app's session data from a sign-in or refresh response. */
  pick: (payload: Record<string, any>, previous: T | null) => T
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<T | null>(null)
  const dataRef = useRef<T | null>(null)
  dataRef.current = data
  // False after a sign-in without "Remember me": nothing is written to the device.
  const rememberRef = useRef(true)

  const persist = useCallback(
    async (tokens: Tokens, next: T) => {
      setTokens(tokens)
      setData(next)
      if (rememberRef.current) await saveItem(storageKey, JSON.stringify({ tokens, data: next }))
    },
    [storageKey],
  )

  const clear = useCallback(async () => {
    setTokens(null)
    setData(null)
    setStatus('signedOut')
    queryClient.clear()
    rememberRef.current = true
    await removeItem(storageKey)
  }, [queryClient, storageKey])

  useEffect(() => {
    bindSession({
      onRefreshed: async (payload) => {
        await persist({ access_token: payload.access_token, refresh_token: payload.refresh_token }, pick(payload, dataRef.current))
      },
      onExpired: () => void clear(),
    })
  }, [persist, pick, clear])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const raw = await loadItem(storageKey)
      if (!alive) return
      try {
        const saved = raw ? JSON.parse(raw) : null
        if (saved?.tokens?.access_token && saved?.tokens?.refresh_token) {
          setTokens(saved.tokens)
          setData(saved.data ?? null)
          setStatus('signedIn')
          return
        }
      } catch {
        /* corrupted entry: treat as signed out */
      }
      setStatus('signedOut')
    })()
    return () => {
      alive = false
    }
  }, [storageKey])

  const signIn = useCallback(
    async (payload: AuthPayload, options?: { remember?: boolean }) => {
      queryClient.clear()
      if (options?.remember !== undefined) {
        rememberRef.current = options.remember
        if (!options.remember) await removeItem(storageKey)
      }
      await persist({ access_token: payload.access_token, refresh_token: payload.refresh_token }, pick(payload, dataRef.current))
      setStatus('signedIn')
    },
    [persist, pick, queryClient, storageKey],
  )

  const signOut = useCallback(async () => {
    const refresh = getTokens()?.refresh_token
    if (refresh) {
      // Best effort: the device signs out even when the server cannot be reached.
      api.public.post('/api/auth/logout', { refresh_token: refresh }).catch(() => {})
    }
    await clear()
  }, [clear])

  const update = useCallback(
    async (patch: Partial<T>) => {
      const tokens = getTokens()
      if (!tokens || !dataRef.current) return
      await persist(tokens, { ...dataRef.current, ...patch })
    },
    [persist],
  )

  const value = useMemo(() => ({ status, data, signIn, signOut, update }), [status, data, signIn, signOut, update])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
