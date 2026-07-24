'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AUTH } from '@/lib/marketing/copy'

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
    canSharePublicly: boolean
    canExportSummary: boolean
    canAccessPaidFeatures: boolean
    canMonitor: boolean
    canUseMcp: boolean
    canScanRepositories: boolean
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

let claimToastShown = false

export function useMe(options?: { claim?: boolean; showClaimToast?: boolean }) {
  const [state, setState] = useState<MeState>({
    user: null,
    isLoading: true,
    claimedCount: null,
    error: null,
  })
  const claim = options?.claim ?? false

  const refresh = useCallback(async () => {
    try {
      setState((current) => ({ ...current, isLoading: true, error: null }))
      const res = await fetch(claim ? '/api/me?claim=1' : '/api/me')
      if (!res.ok) throw new Error(claim ? AUTH.me.claimError : AUTH.me.loadError)
      const data = await res.json()
      setState({
        user: data.user ?? null,
        isLoading: false,
        claimedCount: data.claimedCount ?? null,
        error: null,
      })
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : AUTH.me.loadError
      setState((s) => ({ ...s, isLoading: false, error: message }))
      return null
    }
  }, [claim])

  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false

    ;(async () => {
      try {
        const res = await fetch(claim ? '/api/me?claim=1' : '/api/me')
        if (!res.ok) throw new Error(claim ? AUTH.me.claimError : AUTH.me.loadError)
        const data = await res.json()
        if (cancelRef.current) return
        setState({
          user: data.user ?? null,
          isLoading: false,
          claimedCount: data.claimedCount ?? null,
          error: null,
        })
        if (claim && options?.showClaimToast && data.claimedCount > 0 && !claimToastShown) {
          claimToastShown = true
          toast.success(AUTH.me.claimSuccess(data.claimedCount))
        }
      } catch (error) {
        if (cancelRef.current) return
        setState((s) => ({
          ...s,
          isLoading: false,
          error: error instanceof Error ? error.message : AUTH.me.loadError,
        }))
        if (claim && options?.showClaimToast) {
          toast.error(AUTH.me.claimFailure)
        }
      }
    })()

    return () => {
      cancelRef.current = true
    }
  }, [claim, options?.showClaimToast, refresh])

  return { ...state, refresh }
}
