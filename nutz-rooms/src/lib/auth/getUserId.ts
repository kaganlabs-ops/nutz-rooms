'use client'

import { useAuth } from '@/hooks/useAuth'

/**
 * Hook that returns the appropriate userId:
 * - Supabase UUID if logged in
 * - Anonymous localStorage ID if not logged in
 */
export function useUserId() {
  const { user, isLoggedIn, loading } = useAuth()

  // If logged in, use Supabase user ID
  if (isLoggedIn && user) {
    return {
      userId: user.id,
      isAnonymous: false,
      loading,
    }
  }

  // Anonymous user - use or create localStorage ID
  if (typeof window !== 'undefined') {
    let anonId = localStorage.getItem('nutz-user-id')
    if (!anonId) {
      anonId = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      localStorage.setItem('nutz-user-id', anonId)
    }
    return {
      userId: anonId,
      isAnonymous: true,
      loading,
    }
  }

  // SSR fallback
  return {
    userId: null,
    isAnonymous: true,
    loading: true,
  }
}

/**
 * Get userId synchronously (for non-hook contexts)
 * Only works on client side
 */
export function getAnonymousUserId(): string {
  if (typeof window === 'undefined') {
    throw new Error('getAnonymousUserId can only be called on client side')
  }

  let anonId = localStorage.getItem('nutz-user-id')
  if (!anonId) {
    anonId = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem('nutz-user-id', anonId)
  }
  return anonId
}
