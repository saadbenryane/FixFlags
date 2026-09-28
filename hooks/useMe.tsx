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
import { parseApiErrorResponse } from '@/lib/api/parse-error'
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
  entitlements: {
    canExportSummary: boolean
    canAccessPaidFeatures: boolean
    canMonitor: boolean
    canWatchProduct: boolean
  }
  vibecodingLevel: string | null
  preferredTools: string[]
}

/**
 * Raised when a claim is refused because the plan already covers as many
 * websites as it includes. Distinct from a transient failure so the surface can
 * offer the upgrade step instead of a retry that cannot succeed.
 */
export interface ClaimUpgrade {
  kind: 'claim-limit'
  /** API detail stating the concrete capacity, when the body carried one. */
  message?: string
}

interface MeState {
  user: MeUser | null
  isLoading: boolean
  claimedCount: number | null
  error: string | null
}

interface MeContextValue extends MeState {
  claimUpgrade: ClaimUpgrade | null
  ensureLoaded: () => Promise<{ user?: MeUser | null } | null>
  refresh: () => Promise<{ user?: MeUser | null } | null>
  claimAnonymous: (options?: { showToast?: boolean }) => Promise<{
    user?: MeUser | null
    claimedCount?: number
  } | null>
  dismissClaimUpgrade: () => void
}

const MeContext = createContext<MeContextValue | null>(null)
let claimToastShown = false

/**
 * Claim responses that mean "this plan cannot hold another Site", not
 * "something broke". Anything else keeps the generic retry path. 409 is the
 * status /api/me/claim answers the product limit with, so a body whose code is
 * missing (or unreadable) is still classified rather than reported as a fault.
 */
const CLAIM_UPGRADE_CODES = new Set(['PROJECT_LIMIT', 'UPGRADE_REQUIRED'])

function claimUpgradeFrom(
  body: { code?: string; message?: string },
  status: number
): ClaimUpgrade | null {
  const isLimit = CLAIM_UPGRADE_CODES.has(body.code ?? '') || status === 409
  if (!isLimit) return null
  return { kind: 'claim-limit', ...(body.message ? { message: body.message } : {}) }
}

/**
 * The claim limit is a session fact, not a screen fact. The claim runs under the
 * root provider during /post-login and the notice renders under the app
 * provider on the dashboard, which are two independent contexts. The signal
 * lives beside them so both read the same value instead of the customer losing
 * the reason for the block at the redirect.
 */
let sharedClaimUpgrade: ClaimUpgrade | null = null
const claimUpgradeListeners = new Set<(next: ClaimUpgrade | null) => void>()

function publishClaimUpgrade(next: ClaimUpgrade | null) {
  if (sharedClaimUpgrade === next) return
  sharedClaimUpgrade = next
  for (const listener of claimUpgradeListeners) listener(next)
}

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
  const [claimUpgrade, setClaimUpgrade] = useState<ClaimUpgrade | null>(sharedClaimUpgrade)
  const loadedRef = useRef(initiallyResolved)
  const requestRef = useRef<Promise<{ user?: MeUser | null } | null> | null>(null)

  useEffect(() => {
    const listener = (next: ClaimUpgrade | null) => setClaimUpgrade(next)
    claimUpgradeListeners.add(listener)
    setClaimUpgrade(sharedClaimUpgrade)
    return () => {
      claimUpgradeListeners.delete(listener)
    }
  }, [])

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
    // Clear the previous attempt's limit signal so a retry after a real change
    // is not blocked by a stale notice.
    publishClaimUpgrade(null)
    setState((current) => ({ ...current, isLoading: true, error: null }))
    try {
      const response = await fetch('/api/me/claim', { method: 'POST' })
      if (!response.ok) {
        // A refused claim is not a transient fault, so the body is read before
        // falling back. The plan limit keeps its own signal for the UI.
        const upgrade = claimUpgradeFrom(await parseApiErrorResponse(response), response.status)
        publishClaimUpgrade(upgrade)
        setState((current) => ({ ...current, isLoading: false, error: AUTH.me.claimError }))
        if (options?.showToast) toast.error(AUTH.me.claimFailure)
        return null
      }
      const data = await response.json()
      loadedRef.current = true
      publishClaimUpgrade(null)
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
    } catch {
      publishClaimUpgrade(null)
      setState((current) => ({ ...current, isLoading: false, error: AUTH.me.claimError }))
      if (options?.showToast) toast.error(AUTH.me.claimFailure)
      return null
    }
  }, [])

  const dismissClaimUpgrade = useCallback(() => {
    publishClaimUpgrade(null)
    setClaimUpgrade(null)
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      claimUpgrade,
      ensureLoaded: () => load(false),
      refresh,
      claimAnonymous,
      dismissClaimUpgrade,
    }),
    [claimAnonymous, claimUpgrade, dismissClaimUpgrade, load, refresh, state]
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
