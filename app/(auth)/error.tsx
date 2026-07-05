'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Heading, Muted } from '@/components/ui/typography'
import { SiteShell } from '@/components/layout/site-shell'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({ level: 'error', event: 'ui.auth.error', digest: error.digest, message: error.message })
    )
  }, [error.message])

  return (
    <SiteShell variant="marketing">
      <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <Heading as="h1">Could not load this page</Heading>
        <Muted className="mt-2 max-w-md">
          Something went wrong. Please try again or return to the homepage.
        </Muted>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </Container>
    </SiteShell>
  )
}
