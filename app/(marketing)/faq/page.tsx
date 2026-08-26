import { FaqSection } from '@/components/marketing/FaqSection'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body } from '@/components/ui/typography'
import { TextLink } from '@/components/ui/text-link'
import { FAQ, FAQ_PAGE, HELP_CENTER } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { faqPageSchema } from '@/lib/marketing/structured-data'

export const metadata = buildPageMetadata('faq', '/faq')

const faqJsonLd = faqPageSchema(FAQ)

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <MarketingPageViewTracker page="/faq" />
      <Section spacing="marketing">
        <Container>
          <div className="mx-auto max-w-3xl space-y-10 sm:space-y-12">
            <div className="text-center">
              <LandingSectionHeader label="FAQ" headline={FAQ_PAGE.title} as="h1" />
              <Body className="mt-4 text-muted-foreground text-pretty">{FAQ_PAGE.subhead}</Body>
              <Body className="mt-2 text-sm text-muted-foreground">
                Prefer step-by-step guides?{' '}
                <TextLink href="/help">{HELP_CENTER.label}</TextLink>
              </Body>
            </div>

            <FaqSection
              items={FAQ}
              title=""
              defaultOpenFirst
              searchable
            />
          </div>
        </Container>
      </Section>
    </>
  )
}
