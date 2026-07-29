import Link from 'next/link'
import type { DocsPageDefinition } from '@/lib/docs/catalog'
import { docsStructuredData } from '@/lib/docs/catalog'

export function DocsPageFrame({
  page,
  children,
}: {
  page: DocsPageDefinition
  children: React.ReactNode
}) {
  const jsonLd = docsStructuredData(page)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_13rem]">
        <article className="min-w-0 px-5 py-12 sm:px-8 sm:py-16 lg:px-12 xl:px-16">
          <div className="mx-auto max-w-3xl">
            <nav aria-label="Breadcrumb" className="mb-7 text-sm text-muted-foreground">
              <Link href="/docs" className="hover:text-foreground hover:underline">
                Docs
              </Link>
              {page.path !== '/docs' ? (
                <>
                  <span aria-hidden className="mx-2">
                    /
                  </span>
                  <span aria-current="page">{page.title}</span>
                </>
              ) : null}
            </nav>
            <header className="mb-12 border-b border-border/60 pb-9">
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-label text-brand">
                {page.group}
              </p>
              <h1 className="font-serif text-4xl font-semibold leading-display tracking-display text-foreground sm:text-5xl">
                {page.title}
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                {page.description}
              </p>
            </header>
            {children}
          </div>
        </article>
        {page.headings.length > 2 ? (
          <aside className="hidden border-l border-border/50 px-5 py-16 xl:block">
            <div className="sticky top-[calc(var(--header-height-marketing)+2rem)]">
              <p className="mb-3 text-xs font-semibold uppercase tracking-label text-muted-foreground">
                On this page
              </p>
              <nav aria-label="On this page">
                <ul className="space-y-1">
                  {page.headings.map((heading) => (
                    <li key={heading.id}>
                      <a
                        href={`#${heading.id}`}
                        className="block rounded-sm py-1.5 text-sm leading-snug text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        {heading.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  )
}
