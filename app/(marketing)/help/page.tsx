import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body } from '@/components/ui/typography'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { HelpKnowledgeSearch } from '@/components/help/HelpKnowledgeSearch'
import { HelpCategoryGrid } from '@/components/help/HelpCategoryGrid'
import { HelpArticleList } from '@/components/help/HelpArticleList'
import { HelpChatEscalate } from '@/components/help/HelpChatEscalate'
import { HELP_CATEGORIES } from '@/lib/help/catalog'
import { getPopularArticles } from '@/lib/help/search'
import { HELP_CENTER } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { helpHubStructuredData } from '@/lib/marketing/structured-data'

export const metadata = buildPageMetadata('help', '/help')

const helpHubJsonLd = helpHubStructuredData(HELP_CATEGORIES)

export default async function HelpCenterPage() {
  const popular = getPopularArticles()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(helpHubJsonLd) }}
      />
      <MarketingPageViewTracker page="/help" />
      <Section spacing="marketing">
      <Container>
        <main className="mx-auto max-w-3xl space-y-10 sm:space-y-12">
          <div className="text-center">
            <LandingSectionHeader
              label={HELP_CENTER.label}
              headline={HELP_CENTER.title}
              as="h1"
            />
            <Body className="mt-4 text-muted-foreground text-pretty">{HELP_CENTER.subhead}</Body>
          </div>

          <HelpKnowledgeSearch />
          <HelpCategoryGrid categories={HELP_CATEGORIES} />
          <HelpArticleList articles={popular} />
          <HelpChatEscalate className="rounded-card glass-surface shadow-card p-5" />
        </main>
      </Container>
      </Section>
    </>
  )
}
