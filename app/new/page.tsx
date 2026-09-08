import { AuditInput } from '@/components/audit/AuditInput'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { REVIEW_ENTRY } from '@/lib/marketing/copy'

export default function NewReviewPage() {
  return (
    <Section spacing="hero">
      <Container className="max-w-2xl px-4">
        <Heading as="h1" className="font-display text-3xl font-bold tracking-display">
          {REVIEW_ENTRY.cta}
        </Heading>
        <p className="mt-3 text-sm text-muted-foreground">
          Unadvertised URL review. The public product is the Shopify purchase path monitor.
        </p>
        <div className="mt-6">
          <AuditInput variant="landing" idSuffix="-new" showLandingExtras={false} />
        </div>
      </Container>
    </Section>
  )
}
