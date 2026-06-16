'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SiteShell } from '@/components/layout/site-shell'
import { Container } from '@/components/ui/container'
import { Heading, Muted } from '@/components/ui/typography'

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
    <SiteShell variant="marketing">
      <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <Heading as="h1">This page could not be loaded</Heading>
        <Muted className="mt-2 max-w-md">
          Your data was not changed. Retry the request or return to the dashboard.
        </Muted>
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
