import type { Route } from 'next'
import Link from 'next/link'
import type { DocsPageDefinition } from '@/lib/docs/catalog'
import { getHelpArticle } from '@/lib/help/search'
import { helpArticlePath } from '@/lib/help/types'
import { Heading } from '@/components/ui/typography'

export function DocsRelatedHelp({ page }: { page: DocsPageDefinition }) {
  const articles = (page.relatedHelpSlugs ?? [])
    .map((slug) => getHelpArticle(slug))
    .filter((article): article is NonNullable<typeof article> => Boolean(article))

  if (articles.length === 0) return null

  return (
    <div className="mt-12 space-y-2 border-t border-border/60 pt-6">
      <Heading as="h2" className="text-lg">
        Related Help articles
      </Heading>
      <ul className="space-y-1">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link
              href={helpArticlePath(article.categoryId, article.slug) as Route}
              className="text-sm font-medium text-brand hover:underline"
            >
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
