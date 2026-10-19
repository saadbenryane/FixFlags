import type { DocsPageDefinition } from '@/lib/docs/catalog'
import { docsStructuredData } from '@/lib/docs/catalog'
import { getDocsPage } from '@/lib/docs/catalog'
import type { Route } from 'next'
import { DocsRelatedHelp } from '@/components/docs/DocsRelatedHelp'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { KnowledgePageHeader } from '@/components/knowledge/KnowledgePageHeader'
import s from './DocsExperience.module.css'

export function DocsPageFrame({
  page,
  children,
}: {
  page: DocsPageDefinition
  children: React.ReactNode
}) {
  const jsonLd = docsStructuredData(page)
  const parent = page.parentKey ? getDocsPage(page.parentKey) : null
  return (
    <>
      <MarketingPageViewTracker page={page.path} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className={s.frame}>
        <article className={s.article}>
          <div className={s.readingColumn}>
            <div className={s.header}>
              <KnowledgePageHeader
                breadcrumbs={[
                  { href: '/docs', label: 'Docs' },
                  ...(parent ? [{ href: parent.path as Route, label: parent.title }] : []),
                  { label: page.title, current: true },
                ]}
                eyebrow={page.group}
                title={page.title}
                description={page.description}
              />
            </div>
            {children}
            <DocsRelatedHelp page={page} />
          </div>
        </article>
        {page.headings.length > 2 ? (
          <div className={s.contents}>
            <div className={s.contentsInner}>
              <p className={s.groupTitle}>
                On this page
              </p>
              <nav aria-label="On this page">
                <ul className="space-y-1">
                  {page.headings.map((heading) => (
                    <li key={heading.id}>
                      <a
                        href={`#${heading.id}`}
                        className={s.contentsLink}
                      >
                        {heading.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
