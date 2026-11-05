'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useMe } from '@/hooks/useMe'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { trackEvent } from '@/lib/analytics/events'
import { withClientDeadline } from '@/lib/api/client-request'
import { z } from 'zod'

const POLL_MS = 800
const MAX_ATTEMPTS = 12

const subscriptionView = z.object({
  id: z.string().min(1), commercialPlan: z.enum(['BUILDER', 'TEAM']),
  effectiveEntitlements: z.object({ available: z.literal(true), sources: z.array(z.string()) }),
})

export function DashboardCheckoutToast() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, refresh } = useMe()
  const refreshAccount = useRef(refresh)
  const returnOwner = useRef<{ query: string; userId: string } | null>(null)
  const settled = useRef<string | null>(null)
  const userId = user?.id
  const query = searchParams.toString()
  useEffect(() => { refreshAccount.current = refresh }, [refresh])

  useEffect(() => {
    const params = new URLSearchParams(query)
    if (params.get('upgraded') !== '1' || !userId) return
    if (returnOwner.current?.query === query && returnOwner.current.userId !== userId) return
    returnOwner.current = { query, userId }
    const key = JSON.stringify([query, userId])
    if (settled.current === key) return
    function cleanupUrl() {
      const next = new URLSearchParams(query)
      next.delete('upgraded')
      next.delete('plan')
      const qs = next.toString()
      router.replace(`${qs ? `/dashboard?${qs}` : '/dashboard'}${window.location.hash}`, { scroll: false })
    }
    const planParam = params.get('plan') ?? 'BUILDER'
    if (params.getAll('upgraded').length !== 1 || params.getAll('plan').length > 1 || (planParam !== 'BUILDER' && planParam !== 'TEAM')) {
      settled.current = key
      cleanupUrl()
      return
    }
    const expectedPlan = planParam
    const planName = PLAN_DEFINITIONS[expectedPlan].name
    const owner = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    async function poll() {
      attempts += 1
      try {
        // Retiring this observer leaves the shared session read with its owner.
        const data = await withClientDeadline(() => refreshAccount.current(), owner.signal, null)
        if (owner.signal.aborted || (data?.user && data.user.id !== userId)) return
        const current = subscriptionView.safeParse(data?.user)
        if (current.success && current.data.commercialPlan === expectedPlan && current.data.effectiveEntitlements.sources.includes('SUBSCRIPTION')) {
          settled.current = key
          toast.success(`Your ${planName} plan is active.`)
          cleanupUrl()
          // This legacy funnel name records observed activation, not a payment receipt.
          try { trackEvent('completed_checkout', { plan: expectedPlan }) } catch { /* Optional analytics cannot interrupt the account handoff. */ }
          return
        }
      } catch { if (owner.signal.aborted) return }
      if (attempts < MAX_ATTEMPTS) {
        timer = setTimeout(() => void poll(), POLL_MS)
        return
      }
      settled.current = key
      toast.message('Plan change not confirmed', {
        description: `We couldn’t confirm your ${planName} plan yet. Check Billing for the current subscription status.`,
        action: { label: 'Billing', onClick: () => router.push('/billing') },
        duration: 8000,
      })
      cleanupUrl()
    }

    void poll()
    return () => {
      owner.abort()
      clearTimeout(timer)
    }
  }, [router, query, userId])

  return null
}
