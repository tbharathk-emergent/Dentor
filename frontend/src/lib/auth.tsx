import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { api, clearSession, getStoredUser, getToken, setActiveClinic, setSession, type ActiveClinic } from './api'

export const SUPER_ADMIN_ROLE = 'Super Admin'

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
  login: (email: string, password: string, remember: boolean) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx>(null!)

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
    clearSession()
    setUser(null)
    location.assign('/login')
  }, [])

  return (
    <Ctx.Provider
      value={{ user, isAuthenticated: !!user, isSuperAdmin: user?.role === SUPER_ADMIN_ROLE, login, logout }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
