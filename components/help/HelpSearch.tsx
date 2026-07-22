'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { HELP_CENTER } from '@/lib/marketing/copy'
import { searchHelpArticles } from '@/lib/help/search'
import { Input } from '@/components/ui/input'
import { Body } from '@/components/ui/typography'

export function HelpSearch() {
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  const results = useMemo(() => searchHelpArticles(deferred), [deferred])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={HELP_CENTER.searchPlaceholder}
          className="h-12 pl-10"
          aria-label={HELP_CENTER.searchPlaceholder}
        />
      </div>
      {deferred.trim() && results.length === 0 && (
        <Body className="text-sm text-muted-foreground">{HELP_CENTER.noResults}</Body>
      )}
      {results.length > 0 && (
        <ul className="divide-y divide-border/60 rounded-card glass-surface shadow-card overflow-hidden">
          {results.map((hit) => (
            <li key={hit.article.slug}>
              <Link
                href={hit.href as Route}
                className="block px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
              >
                <p className="text-sm font-medium text-foreground">{hit.article.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {hit.category.title} · {hit.article.excerpt}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
