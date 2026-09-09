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
import { TextLink } from '@/components/ui/text-link'
import { FAQ_SECTION, faqEntryAnchor, type FaqEntry } from '@/lib/marketing/copy/faq'

interface Props {
  items: readonly FaqEntry[]
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
  title = FAQ_SECTION.title,
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

  const defaultValue =
    defaultOpenFirst && filtered.length > 0 ? faqEntryAnchor(filtered[0].question) : undefined

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
        key={defaultValue ?? query ?? 'closed'}
      >
        {filtered.map((item) => {
          const anchor = faqEntryAnchor(item.question)
          return (
            <AccordionItem
              key={item.question}
              value={anchor}
              id={anchor}
              className={cn(
                'scroll-mt-[var(--header-offset)] border-b-0',
                'rounded-card bg-[var(--glass-bg-subtle)] shadow-glass backdrop-blur-md',
                'transition-[background-color,box-shadow] duration-200 ease-out',
                'has-[[data-state=open]]:glass-surface has-[[data-state=open]]:shadow-card'
              )}
            >
              <AccordionTrigger className="mx-0 px-5 py-3.5 text-left hover:bg-transparent">
                {highlightMatch(item.question, query)}
              </AccordionTrigger>
              <AccordionContent className="max-w-none px-5 pb-5 pr-12 pt-0">
                <p className="text-sm text-muted-foreground text-pretty break-words">
                  {highlightMatch(item.answer, query)}
                </p>
                {item.learnMore ? (
                  <p className="mt-3">
                    <TextLink variant="brand" href={item.learnMore.href} className="min-h-11">
                      {item.learnMore.label}
                    </TextLink>
                  </p>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </section>
  )
}
