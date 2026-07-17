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
  onDismiss?: () => void
}

function authHref(base: '/sign-up' | '/sign-in', nextPath?: string): string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) return base
  const params = new URLSearchParams({ next: nextPath, from: 'report' })
  return `${base}?${params.toString()}`
}

export function AuditLimitGate({ code, action, message, nextPath, onDismiss }: Props) {
  const needsSignup =
    code === 'ANON_LIMIT' ||
    code === 'AUTH_REQUIRED' ||
    action === 'signup'

  const signUpHref = useMemo(() => authHref('/sign-up', nextPath), [nextPath])
  const signInHref = useMemo(() => authHref('/sign-in', nextPath), [nextPath])

  useEffect(() => {
    trackEvent('audit_limit_reached', { reason: code ?? action })
  }, [code, action])

  return (
    <Callout
      variant={needsSignup ? 'warning' : 'danger'}
      title={needsSignup ? 'Create a free account to continue' : 'Audit limit reached'}
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
