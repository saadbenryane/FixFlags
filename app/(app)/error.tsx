'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Heading, Muted } from '@/components/ui/typography'
import { SiteShell } from '@/components/layout/site-shell'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({ level: 'error', event: 'ui.app.error', digest: error.digest, message: error.message })
    )
  }, [error.message])

  return (
    <SiteShell variant="app">
      <Container variant="report" className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <Heading as="h1">Something went wrong</Heading>
        <Muted className="mt-2 max-w-md">Your data was not changed. Try again or return to the dashboard.</Muted>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </Container>
    </SiteShell>
  )
}
