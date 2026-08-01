import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Body } from '@/components/ui/typography'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { BRAND, OFFER, LEGAL_PAGE_META, PRIVACY_SECTIONS } from '@/lib/marketing/copy'

export const metadata = buildPageMetadata('privacy', '/privacy')

export default function PrivacyPage() {
  const sections = [
    PRIVACY_SECTIONS.collect,
    PRIVACY_SECTIONS.use,
    PRIVACY_SECTIONS.reportAccess,
    PRIVACY_SECTIONS.thirdParties,
  ]

  return (
    <Section spacing="default">
      <Container variant="content" className="prose prose-neutral dark:prose-invert space-y-6">
        <Heading as="h1">Privacy Policy</Heading>
        <Body className="text-muted-foreground">Last updated: {LEGAL_PAGE_META.privacyUpdated}</Body>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
              <p>
                {section.title === 'How we use it'
                  ? `${section.body} ${OFFER.privacy}`
                  : section.title === 'Report access'
                    ? `${section.body} ${OFFER.linkPrivacy}`
                    : section.body}
              </p>
            </div>
          ))}

          <h2 className="text-base font-semibold text-foreground">Contact</h2>
          <p>
            Questions about privacy? Email us at{' '}
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
