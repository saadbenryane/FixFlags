import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { HelpArticleList } from '@/components/help/HelpArticleList'
import { HelpChatEscalate } from '@/components/help/HelpChatEscalate'
import { HelpKnowledgeSearch } from '@/components/help/HelpKnowledgeSearch'
import { HelpPageFrame } from '@/components/help/HelpPageFrame'
import { HELP_CATEGORIES } from '@/lib/help/catalog'
import { getArticlesForCategory, getHelpCategory } from '@/lib/help/search'
import { HELP_CENTER, BRAND, SITE_URL } from '@/lib/marketing/copy'
import { DEFAULT_OG_IMAGE } from '@/lib/marketing/metadata'
import type { HelpCategoryId } from '@/lib/help/types'

interface Props {
  params: Promise<{ category: string }>
}

export function generateStaticParams() {
  return HELP_CATEGORIES.map((c) => ({ category: c.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: categoryId } = await params
  const category = getHelpCategory(categoryId as HelpCategoryId)
  if (!category) return { title: HELP_CENTER.label }

  const url = `${SITE_URL}/help/${category.id}`
  return {
    title: `${category.title}: ${BRAND.name} Help`,
    description: category.description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: category.title,
      description: category.description,
      url,
      siteName: BRAND.name,
      images: [DEFAULT_OG_IMAGE],
    },
  }
}

export default async function HelpCategoryPage({ params }: Props) {
  const { category: categoryId } = await params
  const category = getHelpCategory(categoryId as HelpCategoryId)
  if (!category) notFound()

  const articles = getArticlesForCategory(category.id)

  return (
    <Section spacing="marketing">
      <Container>
        <div className="mx-auto max-w-3xl space-y-8">
          <HelpKnowledgeSearch compact />
          <HelpPageFrame kind="category" category={category} />
          <HelpArticleList articles={articles} showHeading={false} />
          <HelpChatEscalate className="rounded-card glass-surface shadow-card p-5" />
        </div>
      </Container>
    </Section>
  )
}
