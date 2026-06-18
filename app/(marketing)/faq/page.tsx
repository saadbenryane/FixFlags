import { FaqSection } from '@/components/marketing/FaqSection'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body } from '@/components/ui/typography'
import { FAQ, FAQ_PAGE } from '@/lib/marketing/copy'
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
      <Section spacing="marketing">
        <Container>
          <div className="mx-auto max-w-3xl space-y-10 sm:space-y-12">
            <div className="text-center">
              <LandingSectionHeader label="FAQ" headline={FAQ_PAGE.title} />
              <Body className="mt-4 text-muted-foreground text-pretty">{FAQ_PAGE.subhead}</Body>
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
