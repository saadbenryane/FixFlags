import type { Route } from 'next'
import Link from 'next/link'

export type KnowledgeBreadcrumb = {
  href?: Route
  label: string
  current?: boolean
}

export function KnowledgePageHeader({
  breadcrumbs,
  meta,
  eyebrow,
  title,
  description,
}: {
  breadcrumbs: readonly KnowledgeBreadcrumb[]
  meta?: string | null
  eyebrow?: string
  title?: string
  description?: string
}) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        {breadcrumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`}>
            {index > 0 ? <span aria-hidden className="mx-2">/</span> : null}
            {crumb.href && !crumb.current ? (
              <Link href={crumb.href} className="hover:text-foreground hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current={crumb.current ? 'page' : undefined}>{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      {meta ? <p className="mt-3 text-xs text-muted-foreground">{meta}</p> : null}
      {title ? (
        <header className={description ? 'mt-6 border-b border-border/60 pb-8' : 'mt-6'}>
          {eyebrow ? (
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-label text-brand">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-serif text-3xl font-semibold leading-display tracking-display text-foreground sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </header>
      ) : null}
    </>
  )
}
