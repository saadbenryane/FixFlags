import { AuditInput } from '@/components/audit/AuditInput'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { REVIEW_ENTRY } from '@/lib/marketing/copy-barrel'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'

export default function NewReviewPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <Section spacing="hero">
        <Container className="max-w-2xl px-4">
          <Heading as="h1" className="text-3xl font-bold tracking-display">
            {PUBLIC_SITE_COPY.analyze}
          </Heading>
          <p className="mt-3 text-sm text-muted-foreground">{REVIEW_ENTRY.description}</p>
          <div className="mt-6">
            <AuditInput variant="landing" idSuffix="-new" showLandingExtras={false} submitLabel={PUBLIC_SITE_COPY.analyze} />
          </div>
        </Container>
      </Section>
    </main>
  )
}
