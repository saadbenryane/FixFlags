'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Heading, Muted } from '@/components/ui/typography'
import { SiteShell } from '@/components/layout/site-shell'
import { AUTH } from '@/lib/marketing/copy'

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
  }, [error.message, error.digest])

  return (
    <SiteShell variant="marketing">
      <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <Heading as="h1">{AUTH.error.title}</Heading>
        <Muted className="mt-2 max-w-md">
          {AUTH.error.body}
        </Muted>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>{AUTH.error.retryCta}</Button>
          <Button asChild variant="outline">
            <Link href="/">{AUTH.error.homeCta}</Link>
          </Button>
        </div>
      </Container>
    </SiteShell>
  )
}
