import type { Route } from 'next'
import Link from 'next/link'
import { getDocsPage } from '@/lib/docs/catalog'
import type { HelpArticle } from '@/lib/help/types'
import { docsPathForPageKey } from '@/lib/help/types'
import { Heading } from '@/components/ui/typography'

export function HelpRelatedDocs({ article }: { article: HelpArticle }) {
  const pages = (article.relatedDocs ?? []).map((key) => getDocsPage(key))
  if (pages.length === 0) return null

  return (
    <div className="space-y-2 border-t border-border/60 pt-6">
      <Heading as="h2" className="text-lg">
        Learn more in Docs
      </Heading>
      <ul className="space-y-1">
        {pages.map((page) => (
          <li key={page.key}>
            <Link
              href={docsPathForPageKey(page.key) as Route}
              className="text-sm font-medium text-brand hover:underline"
            >
              {page.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
