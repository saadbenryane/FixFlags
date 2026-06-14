'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'ui.route.error',
        digest: error.digest,
        message: error.message,
      })
    )
  }, [error])

  return (
    <main id="main-content" className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl">This page could not be loaded</h1>
      <p className="text-sm text-muted-foreground">
        Your data was not changed. Retry the request or return to the dashboard.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </main>
  )
}
