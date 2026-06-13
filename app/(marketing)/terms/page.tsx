import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Body } from '@/components/ui/typography'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('terms', '/terms')

export default function TermsPage() {
  return (
    <Section spacing="default">
      <Container className="prose prose-neutral dark:prose-invert max-w-3xl space-y-6">
        <Heading as="h1">Terms of Service</Heading>
        <Body className="text-muted-foreground">Last updated: June 2026</Body>

        <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">Service</h2>
          <p>
            QualityOS provides automated website quality audits and fix prompts. The service is provided
            as-is. Audit results are guidance, not guarantees of production readiness.
          </p>

          <h2 className="text-base font-semibold text-foreground">Accounts and billing</h2>
          <p>
            Paid plans renew monthly unless cancelled through the Stripe billing portal. Usage limits
            apply per plan. Downgrades take effect at the end of the current billing period.
          </p>

          <h2 className="text-base font-semibold text-foreground">Acceptable use</h2>
          <p>
            Do not use QualityOS to audit sites you do not have permission to test, to abuse rate limits,
            or to reverse-engineer the service.
          </p>

          <h2 className="text-base font-semibold text-foreground">Contact</h2>
          <p>
            Questions about these terms? Email{' '}
            <a href="mailto:hello@qualityos.com" className="text-brand hover:underline">
              hello@qualityos.com
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
