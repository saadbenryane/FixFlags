'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DOCS_GROUPS, DOCS_PAGES } from '@/lib/docs/catalog'
import { cn } from '@/lib/utils'

export function DocsNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Documentation" className="space-y-7">
      {DOCS_GROUPS.map((group) => (
        <section key={group}>
          <h2 className="mb-2 px-3 font-mono text-[0.6875rem] font-semibold uppercase tracking-label text-muted-foreground">
            {group}
          </h2>
          <ul className="space-y-0.5">
            {DOCS_PAGES.filter((page) => page.group === group).map((page) => {
              const active = pathname === page.path
              return (
                <li key={page.path}>
                  <Link
                    href={page.path as Route}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-10 items-center rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                      active
                        ? 'bg-brand/10 font-semibold text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}
