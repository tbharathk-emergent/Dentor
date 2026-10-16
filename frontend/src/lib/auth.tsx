import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { API_BASE_URL, api, clearSession, getStoredUser, getToken, setActiveClinic, setSession, type ActiveClinic } from './api'

export const SUPER_ADMIN_ROLE = 'Super Admin'
// The roles that run a clinic: they manage its sign-ins and change its settings and dashboard banner.
// The API refuses everyone else (403); the app uses this to not offer what would be refused.
const CLINIC_ADMIN_ROLES = ['Clinic Owner', 'Administrator']

export interface User {
  id: string
  name: string
  email: string
  role: string
  user_id?: string
  avatar?: string
  clinic?: ActiveClinic
}

interface AuthCtx {
  user: User | null
  isAuthenticated: boolean
  isSuperAdmin: boolean
  /** Clinic Owner, Administrator, or the Super Admin managing a clinic. */
  isClinicAdmin: boolean
  login: (email: string, password: string, remember: boolean) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx>(null!)

/**
 * Ends the session on the server, so the token stops working there and not only in this
 * browser. Never throws and never holds sign-out up for long: offline, the browser still
 * signs out and the token simply expires.
 */
async function endServerSession(): Promise<void> {
  const token = getToken()
  if (!token) return
  try {
    await Promise.race([
      fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
        keepalive: true, // still delivered if the page has already moved on
      }),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
  } catch {
    /* unreachable API: nothing more to do */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (getToken() ? getStoredUser<User>() : null))

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const res = await api.post<{ access_token: string; user: User }>('/api/auth/login', {
      email,
      password,
      remember,
    })
    setSession(res.access_token, res.user)
    setActiveClinic(null) // a super admin picks a clinic from the platform console
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    void endServerSession().finally(() => {
      clearSession()
      setUser(null)
      location.assign('/login')
    })
  }, [])

  const isSuperAdmin = user?.role === SUPER_ADMIN_ROLE
  const isClinicAdmin = isSuperAdmin || CLINIC_ADMIN_ROLES.includes(user?.role ?? '')

  return (
    <Ctx.Provider value={{ user, isAuthenticated: !!user, isSuperAdmin, isClinicAdmin, login, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
