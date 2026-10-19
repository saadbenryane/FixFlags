'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { HELP_CENTER } from '@/lib/marketing/copy'
import type { KnowledgeSearchEntry, KnowledgeSearchFilter } from '@/lib/knowledge/search'
import { searchKnowledge } from '@/lib/knowledge/search'
import { trackEvent } from '@/lib/analytics/events'
import { Input } from '@/components/ui/input'
import { FilterPill } from '@/components/ui/filter-pill'
import { Body } from '@/components/ui/typography'
import { cn } from '@/lib/utils'

const FILTERS: readonly { id: KnowledgeSearchFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'help', label: 'Help' },
  { id: 'docs', label: 'Docs' },
]

export function KnowledgeSearch({
  entries,
  placeholder = 'Search help and docs…',
  className,
}: {
  entries: readonly KnowledgeSearchEntry[]
  placeholder?: string
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<KnowledgeSearchFilter>('all')
  const deferred = useDeferredValue(query)
  const lastNoResultQuery = useRef<string | null>(null)

  const results = useMemo(
    () => searchKnowledge(deferred, entries, { filter, limit: 12 }),
    [deferred, entries, filter]
  )

  useEffect(() => {
    const trimmed = deferred.trim()
    if (!trimmed || results.length > 0) return
    if (lastNoResultQuery.current === `${filter}:${trimmed}`) return
    lastNoResultQuery.current = `${filter}:${trimmed}`
    trackEvent('help_search_no_results', { query: trimmed, filter })
  }, [deferred, results.length, filter])

  function handleResultClick(hit: (typeof results)[number]) {
    trackEvent('help_search_result_clicked', {
      query: deferred.trim(),
      filter,
      href: hit.href,
      surface: hit.surface,
    })
  }

  return (
    <div role="search" aria-label={placeholder} className={cn('space-y-4', className)}>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <FilterPill key={item.id} active={filter === item.id} onClick={() => setFilter(item.id)}>
            {item.label}
          </FilterPill>
        ))}
      </div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="h-12 pl-10"
          aria-label={placeholder}
        />
      </div>
      {deferred.trim() && results.length === 0 && (
        <Body className="text-sm text-muted-foreground">{HELP_CENTER.noResults}</Body>
      )}
      {results.length > 0 && (
        <ul className="space-y-2 overflow-hidden rounded-card glass-surface shadow-card">
          {results.map((hit) => (
            <li key={`${hit.surface}-${hit.href}`}>
              <Link
                href={hit.href as Route}
                onClick={() => handleResultClick(hit)}
                className="block px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
              >
                <p className="text-sm font-medium text-foreground">{hit.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {hit.surface === 'help' ? 'Help' : 'Docs'} · {hit.surfaceLabel} · {hit.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
