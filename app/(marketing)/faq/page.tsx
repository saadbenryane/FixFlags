import { FaqSection } from '@/components/marketing/FaqSection'
import { WhatsCheckedSection } from '@/components/marketing/WhatsCheckedSection'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Body } from '@/components/ui/typography'
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
      <Section spacing="default">
        <Container>
          <div className="mx-auto max-w-prose space-y-10">
            <div className="space-y-3 text-center">
              <Heading as="h1">{FAQ_PAGE.title}</Heading>
              <Body className="text-muted-foreground">{FAQ_PAGE.subhead}</Body>
            </div>

            <FaqSection
              items={FAQ}
              title=""
              defaultOpenFirst
              searchable
              anchorPills={3}
            />
          </div>
        </Container>
      </Section>

      <WhatsCheckedSection id="rubric" />
    </>
  )
}
