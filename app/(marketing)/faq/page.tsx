import { FaqSection } from '@/components/marketing/FaqSection'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { TextLink } from '@/components/ui/text-link'
import { FAQ, FAQ_PAGE, FAQ_SECTION, HELP_CENTER } from '@/lib/marketing/copy-barrel'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { faqPageSchema } from '@/lib/marketing/structured-data'

export const metadata = buildPageMetadata('faq', '/faq')

const faqJsonLd = faqPageSchema(FAQ, { path: '/faq', name: FAQ_PAGE.title })

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <MarketingPageViewTracker page="/faq" />
      <Section spacing="overview">
        <Container>
          <div className="mx-auto max-w-3xl">
            <MarketingPageHeader eyebrow={FAQ_SECTION.label} title={FAQ_PAGE.title} description={FAQ_PAGE.subhead}>
              <p className="text-sm text-muted-foreground">{FAQ_PAGE.guidesLead}{' '}<TextLink href="/help">{HELP_CENTER.label}</TextLink></p>
            </MarketingPageHeader>

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
