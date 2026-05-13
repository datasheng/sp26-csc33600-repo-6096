'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { User, UserType } from '@/types'
import { authApi } from '@/lib/api'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (u: User | null) => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  setUser: () => {},
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Try to rehydrate from the backend session cookie. Falls back to
  // localStorage cache for instant render, then verifies with /me.
  useEffect(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem('tc_user') : null
    if (cached) {
      try { setUser(JSON.parse(cached)) } catch { /* ignore */ }
    }

    authApi.me()
      .then(res => {
        setUser(res.user)
        localStorage.setItem('tc_user', JSON.stringify(res.user))
      })
      .catch(() => {
        // No session — clear any stale cache
        setUser(null)
        localStorage.removeItem('tc_user')
      })
      .finally(() => setLoading(false))
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await authApi.me()
      setUser(res.user)
      localStorage.setItem('tc_user', JSON.stringify(res.user))
    } catch {
      setUser(null)
      localStorage.removeItem('tc_user')
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password })
    const u = {
      user_id:    (res as any).user_id,
      first_name: (res as any).first_name,
      last_name:  (res as any).last_name,
      email:      (res as any).email,
      user_type:  (res as any).user_type,
      phone:      (res as any).phone,
      address:    (res as any).address,
      city:       (res as any).city,
      state:      (res as any).state,
      zip:        (res as any).zip,
      is_active:  true,
      created_at: (res as any).created_at ?? '',
    } as User
    setUser(u)
    localStorage.setItem('tc_user', JSON.stringify(u))
    router.push(getDashboardRoute(u.user_type as UserType))
  }, [router])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    setUser(null)
    localStorage.removeItem('tc_user')
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export function getDashboardRoute(userType: UserType): string {
  switch (userType) {
    case 'Employer':     return '/employer/dashboard'
    case 'Tradesperson': return '/tradesperson/dashboard'
    case 'Junior':       return '/junior/dashboard'
    case 'Admin':        return '/admin/revenue'
  }
}
