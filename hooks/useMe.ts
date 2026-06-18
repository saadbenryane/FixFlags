'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

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
  }
  entitlements: {
    reportTier: 'free' | 'paid'
    canUseFreeRecheck: boolean
    hasUsedFreeRecheck: boolean
    canSharePublicly: boolean
    canExportSummary: boolean
    canAccessPaidFeatures: boolean
    canRecheck: boolean
    canUseMcp: boolean
  }
  vibecodingLevel: string | null
  preferredTools: string[]
}

interface MeState {
  user: MeUser | null
  isLoading: boolean
  claimedCount: number | null
}

let claimToastShown = false

export function useMe(options?: { claim?: boolean; showClaimToast?: boolean }) {
  const [state, setState] = useState<MeState>({
    user: null,
    isLoading: true,
    claimedCount: null,
  })

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      const data = await res.json()
      setState({
        user: data.user ?? null,
        isLoading: false,
        claimedCount: data.claimedCount ?? null,
      })
      return data
    } catch {
      setState((s) => ({ ...s, isLoading: false }))
      return null
    }
  }, [])

  useEffect(() => {
    if (!options?.claim) {
      refresh()
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/me?claim=1')
        const data = await res.json()
        if (cancelled) return
        setState({
          user: data.user ?? null,
          isLoading: false,
          claimedCount: data.claimedCount ?? null,
        })
        if (
          options.showClaimToast &&
          data.claimedCount > 0 &&
          !claimToastShown
        ) {
          claimToastShown = true
          toast.success(
            `Saved ${data.claimedCount} audit${data.claimedCount !== 1 ? 's' : ''} to your account`
          )
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, isLoading: false }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [options?.claim, options?.showClaimToast, refresh])

  return { ...state, refresh }
}
