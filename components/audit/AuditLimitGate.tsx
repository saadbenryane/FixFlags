'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { trackEvent } from '@/lib/analytics/events'
import { useEffect, useMemo } from 'react'

interface Props {
  code?: string
  action?: string
  message: string
  /** Preserve scan intent after signup/sign-in (e.g. /dashboard?url=...). */
  nextPath?: string
  /** Funnel attribution for the signed_up event (e.g. 'hero', 'final'). */
  from?: string
  onDismiss?: () => void
}

function authHref(base: '/sign-up' | '/sign-in', nextPath?: string, from?: string): string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) return base
  const params = new URLSearchParams({ next: nextPath })
  if (from) params.set('from', from)
  return `${base}?${params.toString()}`
}

export function AuditLimitGate({ code, action, message, nextPath, from, onDismiss }: Props) {
  const needsSignup =
    code === 'ANON_LIMIT' ||
    code === 'AUTH_REQUIRED' ||
    action === 'signup'

  const isPaidAtLimit = code === 'TOKEN_LIMIT' || action === 'buy_credits'

  const signUpHref = useMemo(() => authHref('/sign-up', nextPath, from), [nextPath, from])
  const signInHref = useMemo(() => authHref('/sign-in', nextPath, from), [nextPath, from])

  useEffect(() => {
    trackEvent('audit_limit_reached', { reason: code ?? action })
  }, [code, action])

  return (
    <Callout
      variant={needsSignup ? 'warning' : 'danger'}
      title={needsSignup ? 'Create a free account to continue' : 'New URL check limit reached'}
    >
      <p>{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {needsSignup ? (
          <>
            <Button asChild size="sm">
              <Link href={signUpHref}>Create free account</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={signInHref}>Sign in</Link>
            </Button>
          </>
        ) : isPaidAtLimit ? (
          <>
            <Button asChild size="sm">
              <Link href="/billing#credit-packs">Buy credits</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/pricing">Upgrade plan</Link>
            </Button>
          </>
        ) : (
          <Button asChild size="sm">
            <Link href="/pricing">Upgrade to continue</Link>
          </Button>
        )}
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </Callout>
  )
}
