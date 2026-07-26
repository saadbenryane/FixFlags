'use client'

import './globals.css'
import { fontVariables } from '@/lib/design/fonts'
import { Button } from '@/components/ui/button'
import { PageTitle } from '@/components/ui/typography'
import { SYSTEM_COPY } from '@/lib/marketing/copy'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error(
    JSON.stringify({
      level: 'error',
      boundary: 'global',
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  )

  return (
    <html lang="en">
      <body
        className={`${fontVariables} flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground font-sans antialiased`}
      >
        <PageTitle className="text-2xl">{SYSTEM_COPY.errors.criticalTitle}</PageTitle>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {SYSTEM_COPY.errors.criticalBody}
        </p>
        <Button type="button" onClick={() => reset()} className="mt-6">
          {SYSTEM_COPY.actions.retry}
        </Button>
      </body>
    </html>
  )
}
