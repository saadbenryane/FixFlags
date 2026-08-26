import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { HelpArticleBody } from '@/components/help/HelpArticleBody'
import { HelpArticleFeedback } from '@/components/help/HelpArticleFeedback'
import { HelpChatEscalate } from '@/components/help/HelpChatEscalate'
import { HelpKnowledgeSearch } from '@/components/help/HelpKnowledgeSearch'
import { HelpPageFrame } from '@/components/help/HelpPageFrame'
import { HelpRelatedDocs } from '@/components/help/HelpRelatedDocs'
import { HELP_ARTICLES } from '@/lib/help/catalog'
import {
  getHelpArticle,
  getHelpCategory,
  getRelatedArticles,
} from '@/lib/help/search'
import { helpArticlePath } from '@/lib/help/types'
import { HELP_CENTER, BRAND, SITE_URL } from '@/lib/marketing/copy'
import { DEFAULT_OG_IMAGE } from '@/lib/marketing/metadata'
import type { HelpArticleSlug, HelpCategoryId } from '@/lib/help/types'

interface Props {
  params: Promise<{ category: string; slug: string }>
}

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({
    category: a.categoryId,
    slug: a.slug,
  }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = getHelpArticle(slug as HelpArticleSlug)
  if (!article) return { title: HELP_CENTER.label }

  const url = `${SITE_URL}${helpArticlePath(article.categoryId, article.slug)}`
  return {
    title: `${article.title}: ${BRAND.name} Help`,
    description: article.excerpt,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      url,
      siteName: BRAND.name,
      images: [DEFAULT_OG_IMAGE],
    },
  }
}

export default async function HelpArticlePage({ params }: Props) {
  const { category: categoryId, slug } = await params
  const article = getHelpArticle(slug as HelpArticleSlug)
  if (!article || article.categoryId !== categoryId) notFound()

  const category = getHelpCategory(categoryId as HelpCategoryId)
  if (!category) notFound()

  const related = getRelatedArticles(article.slug)

  return (
    <Section spacing="marketing">
      <Container>
        <article className="mx-auto max-w-3xl space-y-8">
          <HelpKnowledgeSearch compact />
          <HelpPageFrame kind="article" article={article} category={category} />

          <HelpArticleBody blocks={article.body} />

          <HelpRelatedDocs article={article} />

          {related.length > 0 && (
            <div className="space-y-3 border-t border-border/60 pt-8">
              <Heading as="h2" className="text-lg">
                {HELP_CENTER.relatedHeading}
              </Heading>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={helpArticlePath(r.categoryId, r.slug) as Route}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <HelpArticleFeedback articleSlug={article.slug} />
          <HelpChatEscalate
            articleTitle={article.title}
            className="rounded-card glass-surface shadow-card p-5"
          />
        </article>
      </Container>
    </Section>
  )
}
