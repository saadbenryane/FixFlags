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
let pendingMePromise: Promise<MeState> | null = null

async function fetchMeShared(): Promise<MeState> {
  if (pendingMePromise) return pendingMePromise
  pendingMePromise = (async () => {
    try {
      const res = await fetch('/api/me')
      if (!res.ok) throw new Error('Could not load your account.')
      const data = await res.json()
      return { user: data.user ?? null, isLoading: false, claimedCount: data.claimedCount ?? null, error: null }
    } catch (error) {
      return { user: null, isLoading: false, claimedCount: null, error: error instanceof Error ? error.message : 'Could not load your account.' }
    }
  })()
  pendingMePromise.finally(() => { pendingMePromise = null })
  return pendingMePromise
}

export function useMe(options?: { claim?: boolean; showClaimToast?: boolean }) {
  const [state, setState] = useState<MeState>({
    user: null,
    isLoading: true,
    claimedCount: null,
    error: null,
  })

  const refresh = useCallback(async () => {
    try {
      setState((current) => ({ ...current, isLoading: true, error: null }))
      const res = await fetch(options?.claim ? '/api/me?claim=1' : '/api/me')
      if (!res.ok) throw new Error('Could not save your report to this account.')
      const data = await res.json()
      setState({
        user: data.user ?? null,
        isLoading: false,
        claimedCount: data.claimedCount ?? null,
        error: null,
      })
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load your account.'
      setState((s) => ({ ...s, isLoading: false, error: message }))
      return null
    }
  }, [options?.claim])

  useEffect(() => {
    if (!options?.claim) {
      fetchMeShared().then((data) => setState(data))
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/me?claim=1')
        if (!res.ok) throw new Error('Could not save your report to this account.')
        const data = await res.json()
        if (cancelled) return
        setState({
          user: data.user ?? null,
          isLoading: false,
          claimedCount: data.claimedCount ?? null,
          error: null,
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
      } catch (error) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Could not save your report to this account.',
          }))
          if (options.showClaimToast) {
            toast.error('Could not save your scan to this account. Refresh and try again.')
          }
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [options?.claim, options?.showClaimToast, refresh])

  return { ...state, refresh }
}
