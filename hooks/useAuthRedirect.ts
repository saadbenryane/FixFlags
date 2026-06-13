'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const PAID_PLANS = ['BUILDER', 'TEAM', 'STUDIO'] as const

export function sanitizeNextPath(next: string | null): string | null {
  if (!next) return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  return next
}

function buildPostLoginQuery(next: string | null, plan: string | null): string {
  const params = new URLSearchParams()
  if (next) params.set('next', next)
  if (plan && PAID_PLANS.includes(plan as (typeof PAID_PLANS)[number])) {
    params.set('plan', plan)
  }
  const qs = params.toString()
  return qs ? `/post-login?${qs}` : '/post-login'
}

export function useAuthRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const next = useMemo(
    () => sanitizeNextPath(searchParams.get('next')),
    [searchParams]
  )
  const plan = searchParams.get('plan')

  const oauthCallbackURL = useMemo(
    () => buildPostLoginQuery(next, plan),
    [next, plan]
  )

  const navigateAfterAuth = useCallback(async () => {
    if (plan && PAID_PLANS.includes(plan as (typeof PAID_PLANS)[number])) {
      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, useFounding: true }),
      })
      if (checkoutRes.ok) {
        const { url } = await checkoutRes.json()
        if (url) {
          window.location.href = url
          return
        }
      }
      router.push('/pricing')
      return
    }

    router.push(next ?? '/dashboard')
  }, [next, plan, router])

  function signInHref(extraNext?: string) {
    const params = new URLSearchParams()
    const targetNext = extraNext ?? next
    if (targetNext) params.set('next', targetNext)
    if (plan) params.set('plan', plan)
    const qs = params.toString()
    return qs ? `/sign-in?${qs}` : '/sign-in'
  }

  function signUpHref() {
    const params = new URLSearchParams()
    if (next) params.set('next', next)
    if (plan) params.set('plan', plan)
    const qs = params.toString()
    return qs ? `/sign-up?${qs}` : '/sign-up'
  }

  return {
    next,
    plan,
    oauthCallbackURL,
    navigateAfterAuth,
    signInHref,
    signUpHref,
  }
}
