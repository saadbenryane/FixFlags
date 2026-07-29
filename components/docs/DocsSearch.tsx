'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { DocsSearchEntry } from '@/lib/docs/content'
import { cn } from '@/lib/utils'

export function DocsSearch({
  entries,
  compact = false,
}: {
  entries: readonly DocsSearchEntry[]
  compact?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const normalized = query.trim().toLowerCase()

  const results = useMemo(() => {
    if (!normalized) return []
    return entries
      .filter((entry) =>
        `${entry.title} ${entry.description} ${entry.keywords}`.toLowerCase().includes(normalized)
      )
      .slice(0, 8)
  }, [entries, normalized])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Search documentation
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setQuery('')
              setOpen(false)
            }
          }}
          aria-controls={listId}
          aria-expanded={open && Boolean(normalized)}
          placeholder="Search docs"
          className={cn(
            'h-11 w-full rounded-[var(--radius-control)] border border-border/70 bg-background pl-9 pr-9 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-brand/60 focus:ring-2 focus:ring-focus-ring',
            compact ? 'min-w-0' : 'min-w-[15rem]'
          )}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setOpen(false)
            }}
            className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {open && normalized ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(26rem,65vh)] overflow-y-auto rounded-[var(--radius-card)] border border-border/70 bg-background p-1.5 shadow-xl"
        >
          {results.length ? (
            results.map((result) => (
              <Link
                key={`${result.href}-${result.title}`}
                href={result.href as Route}
                role="option"
                onClick={() => {
                  setQuery('')
                  setOpen(false)
                }}
                className="block rounded-[var(--radius-control)] px-3 py-2.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span className="block text-sm font-semibold text-foreground">{result.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                  {result.description}
                </span>
              </Link>
            ))
          ) : (
            <div className="px-3 py-6 text-center">
              <p className="text-sm font-medium text-foreground">No results</p>
              <p className="mt-1 text-xs text-muted-foreground">Try an editor, tool, or workflow.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
