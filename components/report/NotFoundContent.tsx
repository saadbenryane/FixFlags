'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Heading, Muted } from '@/components/ui/typography'
import { HERO } from '@/lib/marketing/copy'
import { DeletedReportState } from '@/components/report/DeletedReportState'

/**
 * Route-aware 404 content. Report paths (deleted / unknown / expired audits)
 * render a helpful report empty state instead of the generic page-not-found
 * block, so a dead report link is never a dead end.
 */
export function NotFoundContent() {
  const pathname = usePathname()

  if (pathname?.startsWith('/report/')) {
    return <DeletedReportState />
  }

  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <Heading as="h1">Page not found</Heading>
      <Muted className="mt-2 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or was moved.
      </Muted>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/#audit">{HERO.primaryCta}</Link>
        </Button>
      </div>
    </Container>
  )
}
