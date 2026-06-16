import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Body } from '@/components/ui/typography'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { BRAND } from '@/lib/marketing/copy'

export const metadata = buildPageMetadata('terms', '/terms')

export default function TermsPage() {
  return (
    <Section spacing="default">
      <Container variant="content" className="prose prose-neutral dark:prose-invert space-y-6">
        <Heading as="h1">Terms of Service</Heading>
        <Body className="text-muted-foreground">Last updated: June 2026</Body>

        <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">Service</h2>
          <p>
            {BRAND.name} provides automated website QA checks and fix prompts for AI-built products.
            The service is provided as-is. Report results are guidance, not guarantees of production
            readiness.
          </p>

          <h2 className="text-base font-semibold text-foreground">Accounts and billing</h2>
          <p>
            Paid plans renew monthly unless cancelled through the Stripe billing portal. Usage limits
            apply per plan. Downgrades take effect at the end of the current billing period.
          </p>

          <h2 className="text-base font-semibold text-foreground">Acceptable use</h2>
          <p>
            Do not use {BRAND.name} to check sites you do not have permission to test, to abuse rate
            limits, or to reverse-engineer the service.
          </p>

          <h2 className="text-base font-semibold text-foreground">Contact</h2>
          <p>
            Questions about these terms? Email{' '}
            <a href={`mailto:${BRAND.supportEmail}`} className="text-brand hover:underline">
              {BRAND.supportEmail}
            </a>
            .
          </p>
        </section>

        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </Container>
    </Section>
  )
}
