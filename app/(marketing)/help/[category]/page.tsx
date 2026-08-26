import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { HelpArticleList } from '@/components/help/HelpArticleList'
import { HelpChatEscalate } from '@/components/help/HelpChatEscalate'
import { HelpKnowledgeSearch } from '@/components/help/HelpKnowledgeSearch'
import { HelpPageFrame } from '@/components/help/HelpPageFrame'
import { buildHelpCategoryMetadata } from '@/lib/help/metadata'
import { HELP_CATEGORIES } from '@/lib/help/catalog'
import { getArticlesForCategory, getHelpCategory } from '@/lib/help/search'
import { HELP_CENTER } from '@/lib/marketing/copy'
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

  return buildHelpCategoryMetadata(category)
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
