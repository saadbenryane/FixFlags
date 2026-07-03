'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useMe } from '@/hooks/useMe'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { Plan } from '@prisma/client'
import { trackEvent } from '@/lib/analytics/events'

export function DashboardCheckoutToast() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refresh } = useMe()

  useEffect(() => {
    const upgraded = searchParams.get('upgraded') === '1'
    const expertReview = searchParams.get('expert_review') === '1'
    const planParam = searchParams.get('plan')

    if (!upgraded && !expertReview) return

    if (upgraded) {
      trackEvent('completed_checkout', { plan: planParam ?? 'BUILDER' })
      refresh().then((data) => {
        const planKey = (planParam ?? data?.user?.plan ?? 'BUILDER') as Plan
        const planName = PLAN_DEFINITIONS[planKey]?.name ?? 'Pro'
        toast.success(`Welcome to ${planName}! Unlimited monitoring and MCP are now active.`)
      })
    }
    if (expertReview) {
      toast.success('Expert review confirmed. We will respond within 48 hours.')
    }

    const next = new URLSearchParams(searchParams.toString())
    next.delete('upgraded')
    next.delete('expert_review')
    next.delete('plan')
    const qs = next.toString()
    router.replace(qs ? `/dashboard?${qs}` : '/dashboard')
  }, [router, searchParams, refresh])

  return null
}
