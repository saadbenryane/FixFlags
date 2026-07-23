import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SiteShell } from '@/components/layout/site-shell'
import { Heading, Muted } from '@/components/ui/typography'
import { Container } from '@/components/ui/container'
import { HERO } from '@/lib/marketing/copy'

export default function NotFound() {
  return (
    <SiteShell variant="marketing">
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
    </SiteShell>
  )
}
