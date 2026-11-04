'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { useMe } from '@/hooks/useMe'
import {
  PlanPickerDialog,
  isPlanPickerDismissed,
  resetPlanPickerDismissal,
} from '@/components/billing/PlanPickerDialog'
import type { PickerSource } from '@/lib/billing/pick-plan'
import { postAuthDestination, sanitizeNextPath } from '@/lib/auth/redirects'

interface PlanPickerHostProps {
  source: PickerSource
  next?: string
  from?: string
}

export function PlanPickerHost({ source, next, from }: PlanPickerHostProps) {
  const router = useRouter()
  const { isLoading, user } = useMe({ load: true })
  const [open, setOpen] = useState(false)
  const [resolved, setResolved] = useState(false)
  const safeNext = sanitizeNextPath(next ?? null)
  const destination = postAuthDestination(safeNext)

  useEffect(() => {
    if (isLoading || resolved) return
    setResolved(true)

    if (!user) {
      const params = new URLSearchParams()
      if (safeNext) params.set('next', safeNext)
      if (from) params.set('from', from)
      params.set('source', source)
      const qs = params.toString()
      router.replace(qs ? (`/sign-up?${qs}` as Route) : ('/sign-up' as Route))
      return
    }

    if (user.plan && user.plan !== 'FREE') {
      router.replace(destination)
      return
    }

    if (isPlanPickerDismissed() && source !== 'post_signup') {
      router.replace(destination)
      return
    }

    resetPlanPickerDismissal()
    setOpen(true)
  }, [isLoading, user, resolved, router, safeNext, destination, from, source])

  if (isLoading) {
    return (
      <div
        className="flex min-h-[40dvh] items-center justify-center"
        role="status"
        aria-label="Preparing"
      >
        <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/40" />
      </div>
    )
  }

  return (
    <PlanPickerDialog
      open={open}
      onOpenChange={setOpen}
      onDismiss={() => router.replace(destination)}
      source={source}
      fallbackPath={destination}
      respectActiveReport={!safeNext}
    />
  )
}
