'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { FilterPill } from '@/components/ui/filter-pill'
import { IconInput } from '@/components/ui/icon-input'
import { Heading } from '@/components/ui/typography'
import { FAQ_SECTION } from '@/lib/marketing/copy'

export interface FaqItem {
  question: string
  answer: string
}

interface Props {
  items: readonly FaqItem[]
  title?: string
  /** Uppercase label above title (hidden when title is empty) */
  sectionLabel?: string | null
  /** First item open on load (e.g. /faq page) */
  defaultOpenFirst?: boolean
  /** Show search input */
  searchable?: boolean
  /** Pill jumps to first N questions */
  anchorPills?: number
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-brand/20 px-0.5 text-foreground">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function FaqSection({
  items,
  title = 'Frequently asked questions',
  sectionLabel = FAQ_SECTION.label,
  defaultOpenFirst = false,
  searchable = false,
  anchorPills = 0,
}: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [...items]
    return items.filter(
      (item) =>
        item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q)
    )
  }, [items, query])

  const defaultValue = defaultOpenFirst && filtered.length > 0 ? 'item-0' : undefined

  return (
    <section className="space-y-8">
      {title && (
        <div className="space-y-3 text-center">
          {sectionLabel && (
            <p className="section-label">{sectionLabel}</p>
          )}
          <Heading as="h2">{title}</Heading>
        </div>
      )}

      {searchable && (
        <div className="space-y-2">
          <IconInput
            type="search"
            label="Search FAQ"
            icon={<Search className="h-4 w-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions…"
          />
          {query.trim() && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No matches for &ldquo;{query}&rdquo;. Try different keywords.
            </p>
          )}
        </div>
      )}

      {anchorPills > 0 && !query.trim() && (
        <nav aria-label="Jump to question" className="-mx-1 flex flex-wrap gap-2 px-1">
          {items.slice(0, anchorPills).map((item, i) => (
            <FilterPill
              key={item.question}
              onClick={() => {
                const el = document.getElementById(`faq-item-${i}`)
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              {item.question.length > 40 ? `${item.question.slice(0, 37)}…` : item.question}
            </FilterPill>
          ))}
        </nav>
      )}

      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={defaultValue}
        key={defaultValue ?? 'closed'}
      >
        {filtered.map((item, i) => (
          <AccordionItem
            key={item.question}
            value={`item-${i}`}
            id={`faq-item-${i}`}
            className="scroll-mt-[var(--header-offset)] border-border-subtle py-1"
          >
            <AccordionTrigger className="text-left">
              {highlightMatch(item.question, query)}
            </AccordionTrigger>
            <AccordionContent className="pb-4">{highlightMatch(item.answer, query)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
