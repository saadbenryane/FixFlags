'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useMe } from '@/hooks/useMe'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { Plan } from '@prisma/client'
import { trackEvent } from '@/lib/analytics/events'

const POLL_MS = 800
const MAX_ATTEMPTS = 12

const ACTIVATION_SUMMARY: Record<string, string> = {
  BUILDER: 'Before/after compare and MCP are now active.',
  TEAM: 'Client sharing, projects, compare, and MCP are now active.',
}

function activationSummary(plan: string): string {
  return ACTIVATION_SUMMARY[plan] ?? ACTIVATION_SUMMARY.BUILDER
}

export function DashboardCheckoutToast() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refresh } = useMe()
  const started = useRef(false)

  useEffect(() => {
    const upgraded = searchParams.get('upgraded') === '1'
    const planParam = searchParams.get('plan')
    if (!upgraded || started.current) return
    started.current = true

    trackEvent('completed_checkout', { plan: planParam ?? 'BUILDER' })

    const expectedPlan = (planParam ?? 'BUILDER') as Plan
    const planName = PLAN_DEFINITIONS[expectedPlan]?.name ?? PLAN_DEFINITIONS.BUILDER.name
    const paidFeatures = activationSummary(expectedPlan)

    let attempts = 0
    let cancelled = false

    function cleanupUrl() {
      const next = new URLSearchParams(searchParams.toString())
      next.delete('upgraded')
      next.delete('plan')
      const qs = next.toString()
      router.replace(qs ? `/dashboard?${qs}` : '/dashboard')
    }

    async function poll() {
      while (!cancelled && attempts < MAX_ATTEMPTS) {
        attempts += 1
        const data = await refresh()
        const currentPlan = data?.user?.plan as Plan | undefined
        if (currentPlan === expectedPlan) {
          toast.success(`Welcome to ${planName}. ${paidFeatures}`)
          cleanupUrl()
          return
        }
        await new Promise((r) => setTimeout(r, POLL_MS))
      }
      if (!cancelled) {
        toast.message(`Activating ${planName}…`, {
          description: 'Payment received. Entitlements usually sync within a few seconds.',
          action: {
            label: 'Billing',
            onClick: () => router.push('/billing'),
          },
          duration: 8000,
        })
        cleanupUrl()
      }
    }

    void poll()
    return () => {
      cancelled = true
    }
  }, [router, searchParams, refresh])

  return null
}
