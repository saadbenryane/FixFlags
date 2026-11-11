import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader'
import { HelpKnowledgeSearch } from '@/components/help/HelpKnowledgeSearch'
import { HelpCategoryGrid } from '@/components/help/HelpCategoryGrid'
import { HelpArticleList } from '@/components/help/HelpArticleList'
import { HelpChatEscalate } from '@/components/help/HelpChatEscalate'
import { FaqSection } from '@/components/marketing/FaqSection'
import { Heading } from '@/components/ui/typography'
import { HELP_CATEGORIES } from '@/lib/help/catalog'
import { getPopularArticles } from '@/lib/help/search'
import { FAQ, FAQ_PAGE, HELP_CENTER } from '@/lib/marketing/copy-barrel'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { faqPageSchema, helpHubStructuredData } from '@/lib/marketing/structured-data'

export const metadata = buildPageMetadata('help', '/help')

const helpHubJsonLd = helpHubStructuredData(HELP_CATEGORIES)
// The FAQ lives on Help at #faq; `/faq` redirects here.
const faqJsonLd = faqPageSchema(FAQ, { path: '/help', name: FAQ_PAGE.title })

export default async function HelpCenterPage() {
  const popular = getPopularArticles()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(helpHubJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <MarketingPageViewTracker page="/help" />
      <Section spacing="overview">
      <Container>
        <div className="mx-auto max-w-3xl">
          <MarketingPageHeader eyebrow={HELP_CENTER.label} title={HELP_CENTER.title} description={HELP_CENTER.subhead} />

          <div className="space-y-10 sm:space-y-12">
            <HelpKnowledgeSearch />
            <HelpCategoryGrid categories={HELP_CATEGORIES} />
            <HelpArticleList articles={popular} />
            <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-[var(--header-offset)] space-y-4">
              <Heading as="h2" id="faq-heading" className="text-lg">{FAQ_PAGE.title}</Heading>
              <FaqSection items={FAQ} title="" sectionLabel={null} />
            </section>
            <HelpChatEscalate className="rounded-card glass-surface shadow-card p-5" />
          </div>
        </div>
      </Container>
      </Section>
    </>
  )
}
