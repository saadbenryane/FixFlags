'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { IconInput } from '@/components/ui/icon-input'
import { cn } from '@/lib/utils'
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
            icon={<Search className="h-4 w-4" strokeWidth={2} />}
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

      <Accordion
        type="single"
        collapsible
        className="flex w-full flex-col gap-2"
        defaultValue={defaultValue}
        key={defaultValue ?? 'closed'}
      >
        {filtered.map((item, i) => (
          <AccordionItem
            key={item.question}
            value={`item-${i}`}
            id={`faq-item-${i}`}
            className={cn(
              'scroll-mt-[var(--header-offset)] border-b-0',
              'rounded-full bg-[var(--glass-bg-subtle)] shadow-glass backdrop-blur-md',
              'transition-[border-radius,background-color,box-shadow] duration-200 ease-out',
              'has-[[data-state=open]]:rounded-card has-[[data-state=open]]:glass-surface has-[[data-state=open]]:shadow-card'
            )}
          >
            <AccordionTrigger className="px-5 py-3.5 text-left hover:bg-transparent">
              {highlightMatch(item.question, query)}
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-4 pt-0">
              {highlightMatch(item.answer, query)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
