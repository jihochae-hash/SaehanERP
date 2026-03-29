import { create } from 'zustand'
import type { UserProfile, UserClaims, ModuleCode } from '@/types'

interface AuthStore {
  user: UserProfile | null
  claims: UserClaims | null
  isLoading: boolean
  isAuthenticated: boolean
  lastActivity: number

  // Actions
  setUser: (user: UserProfile | null) => void
  setClaims: (claims: UserClaims | null) => void
  setLoading: (loading: boolean) => void
  updateActivity: () => void
  logout: () => void
  hasModule: (module: ModuleCode) => boolean
  isCeo: () => boolean
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  claims: null,
  isLoading: true,
  isAuthenticated: false,
  lastActivity: Date.now(),

  setUser: (user) =>
    set({ user, isAuthenticated: !!user }),

  setClaims: (claims) =>
    set({ claims }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  updateActivity: () =>
    set({ lastActivity: Date.now() }),

  logout: () =>
    set({
      user: null,
      claims: null,
      isAuthenticated: false,
      isLoading: false,
      lastActivity: 0,
    }),

  hasModule: (module) => {
    const { claims } = get()
    if (!claims) return false
    if (claims.role === 'ceo') return true
    return claims.modules.includes(module)
  },

  isCeo: () => get().claims?.role === 'ceo',
}))
