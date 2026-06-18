'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'

interface Props {
  code?: string
  action?: string
  message: string
  onDismiss?: () => void
}

export function AuditLimitGate({ code, action, message, onDismiss }: Props) {
  const needsSignup =
    code === 'ANON_LIMIT' ||
    code === 'AUTH_REQUIRED' ||
    action === 'signup'

  return (
    <Callout
      variant="danger"
      title={needsSignup ? 'Sign up to continue' : 'Audit limit reached'}
    >
      <p>{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {needsSignup ? (
          <>
            <Button asChild size="sm">
              <Link href="/sign-up">Create free account</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/sign-in">Sign in</Link>
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
