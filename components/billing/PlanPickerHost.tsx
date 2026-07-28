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

interface PlanPickerHostProps {
  source: PickerSource
  next?: string
  from?: string
}

function fallbackRoute(next: string | undefined): Route {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next as Route
  return '/dashboard'
}

export function PlanPickerHost({ source, next, from }: PlanPickerHostProps) {
  const router = useRouter()
  const { isLoading, user } = useMe({ load: true })
  const [open, setOpen] = useState(false)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    if (isLoading || resolved) return
    setResolved(true)

    if (!user) {
      const params = new URLSearchParams()
      if (next) params.set('next', next)
      if (from) params.set('from', from)
      params.set('source', source)
      const qs = params.toString()
      router.replace(qs ? (`/sign-up?${qs}` as Route) : ('/sign-up' as Route))
      return
    }

    if (user.plan && user.plan !== 'FREE') {
      router.replace(fallbackRoute(next))
      return
    }

    if (isPlanPickerDismissed() && source !== 'post_signup') {
      router.replace(fallbackRoute(next))
      return
    }

    resetPlanPickerDismissal()
    setOpen(true)
  }, [isLoading, user, resolved, router, next, from, source])

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
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          router.replace(fallbackRoute(next))
        }
      }}
      source={source}
      fallbackPath={next}
    />
  )
}
