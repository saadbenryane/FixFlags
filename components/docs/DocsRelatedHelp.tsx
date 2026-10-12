import type { Route } from 'next'
import Link from 'next/link'
import type { DocsPageDefinition } from '@/lib/docs/catalog'
import { getHelpArticle } from '@/lib/help/search'
import { helpArticlePath } from '@/lib/help/types'
import { Heading } from '@/components/ui/typography'
import { ArrowRight } from 'lucide-react'
import s from './DocsExperience.module.css'

export function DocsRelatedHelp({ page }: { page: DocsPageDefinition }) {
  const articles = (page.relatedHelpSlugs ?? [])
    .map((slug) => getHelpArticle(slug))
    .filter((article): article is NonNullable<typeof article> => Boolean(article))

  if (articles.length === 0) return null

  return (
    <div className={s.related}>
      <Heading as="h2" className="text-lg">
        Related Help articles
      </Heading>
      <ul>
        {articles.map((article) => (
          <li key={article.slug}>
            <Link
              href={helpArticlePath(article.categoryId, article.slug) as Route}
              className={s.relatedLink}
            >
              <span>{article.title}</span><ArrowRight aria-hidden size={16} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
