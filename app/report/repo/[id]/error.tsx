'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Heading, Muted } from '@/components/ui/typography'
import { AuditShell } from '@/components/layout/audit-shell'

export default function RepoReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({ level: 'error', event: 'ui.repo-report.error', digest: error.digest, message: error.message })
    )
  }, [error.message, error.digest])

  return (
    <AuditShell>
      <Container variant="report" className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <Heading as="h1">Could not load repo report</Heading>
        <Muted className="mt-2 max-w-md">Something went wrong. Try again or go home.</Muted>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </Container>
    </AuditShell>
  )
}
