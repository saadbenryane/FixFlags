'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { Button } from '@/components/ui/button'
import type { ProductAttentionItemDTO } from '@/lib/products/workspace'
import { cn, severityLabel } from '@/lib/utils'

export function ProductPriorities({ items }: { items: ProductAttentionItemDTO[] }) {
  const [showAll, setShowAll] = useState(false)
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? null)
  const visible = showAll ? items : items.slice(0, 5)
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0], [items, selectedId])

  if (!selected) return <p className="rounded-card border border-border/45 bg-card p-5 text-sm text-muted-foreground">No open priorities. Run an Update review whenever the Product changes.</p>

  return (
    <div className="grid overflow-hidden rounded-card border border-border/45 bg-card shadow-card lg:grid-cols-[minmax(17rem,34%)_minmax(0,1fr)]">
      <div className="border-b border-border/45 p-2 lg:border-b-0 lg:border-r">
        <ol className="space-y-1" aria-label="Ranked priorities">
          {visible.map((item, index) => (
            <li key={item.id}>
              <button type="button" onClick={() => setSelectedId(item.id)} aria-pressed={selected.id === item.id} className={cn('flex min-h-11 w-full items-start gap-3 rounded-control px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring', selected.id === item.id ? 'bg-brand-muted' : 'hover:bg-muted/45')}>
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-background font-mono text-2xs font-semibold tabular-nums">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-foreground">{item.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{severityLabel(item.severity ?? '')}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {items.length > 5 ? <Button type="button" variant="ghost" className="mt-1 w-full" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Show fewer' : `Show more (${items.length - 5})`}</Button> : null}
      </div>

      <article className="p-5 sm:p-6" aria-live="polite">
        <p className="font-mono text-2xs uppercase tracking-label text-brand">Priority {items.findIndex((item) => item.id === selected.id) + 1}</p>
        <h3 className="mt-2 text-xl font-semibold tracking-heading text-foreground">{selected.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selected.judgment}</p>
        {selected.evidence ? <div className="mt-5 rounded-[var(--radius-inner)] bg-muted/30 p-4"><p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">Evidence</p><p className="mt-1 text-sm leading-relaxed text-foreground">{selected.evidence}</p></div> : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div><p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">Improve</p><p className="mt-1 text-sm leading-relaxed">{selected.recommendedChange}</p></div>
          <div><p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">Check</p><p className="mt-1 text-sm leading-relaxed">{selected.successCondition}</p></div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {selected.sourceReviewId ? <Button asChild variant="outline"><Link href={`/report/${selected.sourceReviewId}?view=report&flag=${selected.sourceFlagId ?? ''}` as Route}>View report</Link></Button> : null}
          {selected.prompt && selected.sourceFlagId ? <PromptCopyButton prompt={selected.prompt} auditId={selected.sourceReviewId ?? undefined} flagId={selected.sourceFlagId} surface="product" accessState="owner" itemPosition={items.findIndex((item) => item.id === selected.id) + 1} className="border-brand bg-brand text-brand-foreground hover:bg-brand-hover" /> : null}
        </div>
      </article>
    </div>
  )
}
