'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  code?: string
  action?: string
  message: string
  onDismiss?: () => void
}

export function AuditLimitGate({ code, action, message, onDismiss }: Props) {
  const isAnonLimit = code === 'ANON_LIMIT' || action === 'signup'

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="py-4 px-5 space-y-3">
        <p className="text-sm font-medium">
          {isAnonLimit ? 'Free scan used' : 'Token limit reached'}
        </p>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex flex-wrap gap-2">
          {isAnonLimit ? (
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
      </CardContent>
    </Card>
  )
}
