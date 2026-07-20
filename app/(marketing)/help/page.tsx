import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body } from '@/components/ui/typography'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { HelpSearch } from '@/components/help/HelpSearch'
import { HelpCategoryGrid } from '@/components/help/HelpCategoryGrid'
import { HelpArticleList } from '@/components/help/HelpArticleList'
import { HelpChatEscalate } from '@/components/help/HelpChatEscalate'
import { HELP_CATEGORIES } from '@/lib/help/catalog'
import { getPopularArticles } from '@/lib/help/search'
import { HELP_CENTER } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('help', '/help')

export default function HelpCenterPage() {
  const popular = getPopularArticles()

  return (
    <Section spacing="marketing">
      <Container>
        <div className="mx-auto max-w-3xl space-y-10 sm:space-y-12">
          <div className="text-center">
            <LandingSectionHeader
              label={HELP_CENTER.label}
              headline={HELP_CENTER.title}
              as="h1"
            />
            <Body className="mt-4 text-muted-foreground text-pretty">{HELP_CENTER.subhead}</Body>
          </div>

          <HelpSearch />
          <HelpCategoryGrid categories={HELP_CATEGORIES} />
          <HelpArticleList articles={popular} />
          <HelpChatEscalate className="rounded-card glass-surface shadow-card p-5" />
        </div>
      </Container>
    </Section>
  )
}
