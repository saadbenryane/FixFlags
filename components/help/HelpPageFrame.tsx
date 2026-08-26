import type { Route } from 'next'
import Link from 'next/link'
import type { HelpArticle, HelpCategory } from '@/lib/help/types'
import { helpCategoryPath } from '@/lib/help/types'
import { KnowledgePageHeader } from '@/components/knowledge/KnowledgePageHeader'
import {
  helpArticleStructuredData,
  helpCategoryStructuredData,
} from '@/lib/marketing/structured-data'
import { HELP_CENTER } from '@/lib/marketing/copy'

type HelpPageFrameProps =
  | {
      kind: 'article'
      article: HelpArticle
      category: HelpCategory
      children?: React.ReactNode
    }
  | {
      kind: 'category'
      category: HelpCategory
      children?: React.ReactNode
    }

export function HelpPageFrame(props: HelpPageFrameProps) {
  const jsonLd =
    props.kind === 'article'
      ? helpArticleStructuredData(props.article, props.category)
      : helpCategoryStructuredData(props.category)

  const breadcrumbs =
    props.kind === 'article'
      ? [
          { href: '/help' as Route, label: HELP_CENTER.label },
          { href: helpCategoryPath(props.category.id), label: props.category.title },
          { label: props.article.title, current: true },
        ]
      : [
          { href: '/help' as Route, label: HELP_CENTER.label },
          { label: props.category.title, current: true },
        ]

  const meta =
    props.kind === 'article' && props.article.updatedAt
      ? [
          props.article.estimatedReadMinutes
            ? `${props.article.estimatedReadMinutes} min read`
            : null,
          `Updated ${new Date(props.article.updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}`,
        ]
          .filter(Boolean)
          .join(' · ')
      : null

  const title = props.kind === 'article' ? props.article.title : props.category.title
  const description = props.kind === 'article' ? props.article.excerpt : props.category.description
  const eyebrow = props.kind === 'article' ? props.category.title : HELP_CENTER.label

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <KnowledgePageHeader
        breadcrumbs={breadcrumbs}
        meta={meta}
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      {props.children}
    </>
  )
}
