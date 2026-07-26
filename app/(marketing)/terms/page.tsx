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
        <Body className="text-muted-foreground">Last updated: July 2026</Body>

        <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">Service</h2>
          <p>
            {BRAND.name} provides automated website QA checks and fix prompts for AI-built products.
            The service is provided as-is. Report results are guidance for your own review, not
            guarantees of production readiness, compliance, accessibility certification, or legal
            advice.
          </p>

          <h2 className="text-base font-semibold text-foreground">Accounts and billing</h2>
          <p>
            Paid plans renew monthly unless you cancel through the Stripe billing portal. Usage
            limits apply to new URL checks per plan. Re-checks on reports you own are unlimited and
            do not consume plan quota. Downgrades and cancellations take effect at the end of the
            current billing period unless Stripe indicates otherwise.
          </p>

          <h2 className="text-base font-semibold text-foreground">Credit packs</h2>
          <p>
            Credit packs are no longer available for purchase. Existing purchased credits remain
            active and do not expire. Unused credit packs may be refunded within 14 days of
            purchase if no credits from that pack have been consumed. Partially used packs are not
            refundable.
          </p>

          <h2 className="text-base font-semibold text-foreground">Refunds and cancellation</h2>
          <p>
            You may cancel anytime via the Stripe billing portal and keep access through the end of
            the paid period. We do not provide cash refunds for unused subscription time. Chargebacks
            or payment disputes may result in immediate suspension of paid features.
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
