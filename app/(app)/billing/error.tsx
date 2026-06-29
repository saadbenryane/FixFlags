'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Heading, Muted } from '@/components/ui/typography'
import { logger } from '@/lib/logger'

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error(`Billing page error: ${error.message}`)
  }, [error])

  return (
    <Container variant="narrow" className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <Heading as="h1">Billing unavailable</Heading>
      <Muted className="mt-2 max-w-md">Could not load billing information. Try again or return to the dashboard.</Muted>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <a href="/dashboard">Dashboard</a>
        </Button>
      </div>
    </Container>
  )
}
