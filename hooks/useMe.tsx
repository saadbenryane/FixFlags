'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { AUTH } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'

export interface MeUser {
  id: string
  email: string
  name?: string | null
  plan: string
  role: string
  isAdmin: boolean
  checks: {
    used: number
    pending: number
    limit: number | null
    isUnlimited: boolean
    purchasedCredits?: number
    totalAvailable?: number | null
    remaining: number | null
    periodStart: string
    periodEnd: string
  }
  deepReviews: {
    used: number
    limit: number
    remaining: number | null
    periodStart: string
    periodEnd: string
  }
  entitlements: {
    reportTier: 'free' | 'paid'
    canSharePublicly: boolean
    canExportSummary: boolean
    canAccessPaidFeatures: boolean
    canMonitor: boolean
    canWatchProduct: boolean
  }
  vibecodingLevel: string | null
  preferredTools: string[]
}

interface MeState {
  user: MeUser | null
  isLoading: boolean
  claimedCount: number | null
  error: string | null
}

interface MeContextValue extends MeState {
  ensureLoaded: () => Promise<{ user?: MeUser | null } | null>
  refresh: () => Promise<{ user?: MeUser | null } | null>
  claimAnonymous: (options?: { showToast?: boolean }) => Promise<{
    user?: MeUser | null
    claimedCount?: number
  } | null>
}

const MeContext = createContext<MeContextValue | null>(null)
let claimToastShown = false

export function MeProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser?: MeUser | null
}) {
  const initiallyResolved = initialUser !== undefined
  const [state, setState] = useState<MeState>({
    user: initialUser ?? null,
    isLoading: !initiallyResolved,
    claimedCount: null,
    error: null,
  })
  const loadedRef = useRef(initiallyResolved)
  const requestRef = useRef<Promise<{ user?: MeUser | null } | null> | null>(null)

  const load = useCallback(async (force = false) => {
    if (!force && loadedRef.current) return { user: state.user }
    if (requestRef.current) return requestRef.current

    setState((current) => ({ ...current, isLoading: true, error: null }))
    requestRef.current = fetch('/api/me')
      .then(async (response) => {
        if (!response.ok) throw new Error(AUTH.me.loadError)
        const data = await response.json()
        loadedRef.current = true
        setState((current) => ({
          ...current,
          user: data.user ?? null,
          isLoading: false,
          error: null,
        }))
        return data
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : AUTH.me.loadError
        setState((current) => ({ ...current, isLoading: false, error: message }))
        return null
      })
      .finally(() => {
        requestRef.current = null
      })

    return requestRef.current
  }, [state.user])

  const refresh = useCallback(() => load(true), [load])

  const claimAnonymous = useCallback(async (options?: { showToast?: boolean }) => {
    try {
      setState((current) => ({ ...current, isLoading: true, error: null }))
      const response = await fetch('/api/me/claim', { method: 'POST' })
      if (!response.ok) throw new Error(AUTH.me.claimError)
      const data = await response.json()
      loadedRef.current = true
      setState({
        user: data.user ?? null,
        isLoading: false,
        claimedCount: data.claimedCount ?? 0,
        error: null,
      })
      if (options?.showToast && data.claimedCount > 0 && !claimToastShown) {
        claimToastShown = true
        toast.success(AUTH.me.claimSuccess(data.claimedCount))
      }
      if (data.claimedCount > 0) {
        trackEvent('audits_claimed', { claimed_count: data.claimedCount })
      }
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : AUTH.me.claimError
      setState((current) => ({ ...current, isLoading: false, error: message }))
      if (options?.showToast) toast.error(AUTH.me.claimFailure)
      return null
    }
  }, [])

  const value = useMemo(
    () => ({ ...state, ensureLoaded: () => load(false), refresh, claimAnonymous }),
    [claimAnonymous, load, refresh, state]
  )

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>
}

export function useMe(options?: { load?: boolean }) {
  const context = useContext(MeContext)
  if (!context) throw new Error('useMe must be used within MeProvider')
  const { ensureLoaded } = context

  useEffect(() => {
    if (options?.load === false) return
    void ensureLoaded()
  }, [ensureLoaded, options?.load])

  return context
}
