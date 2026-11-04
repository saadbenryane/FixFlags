'use client'

import { useEffect, useTransition } from 'react'
import './globals.css'
import { fontVariables } from '@/lib/design/fonts'
import { Button } from '@/components/ui/button'
import { PageTitle } from '@/components/ui/typography'
import { SYSTEM_COPY } from '@/lib/marketing/copy-barrel'
import type { RouteErrorBoundaryProps } from '@/components/ui/route-error-page'

export default function GlobalError({
  error,
  reset,
  retry,
}: RouteErrorBoundaryProps) {
  const [recovering, startRecovery] = useTransition()
  const issue = error instanceof Error ? error as Error & { digest?: unknown } : null
  const digest = typeof issue?.digest === 'string' ? issue.digest : undefined
  const message = issue?.message ?? (typeof error === 'string' ? error : 'Unknown route error')
  const stack = issue?.stack
  useEffect(() => { console.error(
    JSON.stringify({
      level: 'error',
      boundary: 'global',
      message,
      digest,
      stack,
    })
  ) }, [message, digest, stack])

  return (
    <html lang="en">
      <body
        className={`${fontVariables} flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground font-sans antialiased`}
      >
        <PageTitle className="text-2xl">{SYSTEM_COPY.errors.criticalTitle}</PageTitle>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {SYSTEM_COPY.errors.criticalBody}
        </p>
        <Button type="button" onClick={() => startRecovery(retry ?? reset)} loading={recovering} className="mt-6">
          {SYSTEM_COPY.actions.retry}
        </Button>
      </body>
    </html>
  )
}
