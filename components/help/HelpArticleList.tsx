import Link from 'next/link'
import type { HelpArticle } from '@/lib/help/types'
import { helpArticlePath } from '@/lib/help/types'
import { HELP_CENTER } from '@/lib/marketing/copy'
import { Heading, Body } from '@/components/ui/typography'

export function HelpArticleList({
  articles,
  heading,
  showHeading = true,
}: {
  articles: readonly HelpArticle[]
  heading?: string
  showHeading?: boolean
}) {
  if (articles.length === 0) return null
  return (
    <div className="space-y-4">
      {showHeading && (
        <Heading as="h2" className="text-lg">
          {heading ?? HELP_CENTER.popularHeading}
        </Heading>
      )}
      <ul className="divide-y divide-border/60 rounded-card glass-surface shadow-card overflow-hidden">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link
              href={helpArticlePath(article.categoryId, article.slug)}
              className="block px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
            >
              <p className="text-sm font-medium text-foreground">{article.title}</p>
              <Body className="mt-0.5 text-xs text-muted-foreground">{article.excerpt}</Body>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
