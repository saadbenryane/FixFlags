'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

/**
 * Row C of the Report pane. Stack, contract, funnel, previews, gates, and the
 * review footer are real report context, but they are not the work, so they
 * stay behind one disclosure instead of pushing the fix list down the pane.
 * A deep link to any section inside opens the disclosure first.
 */
export function ReportContextDisclosure({
  sectionIds,
  children,
  className,
}: {
  /** Section ids carried inside, so anchors can open the disclosure. */
  sectionIds: string[]
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const openForHash = () => {
      const hash = window.location.hash.replace('#', '')
      if (!hash || !sectionIds.includes(hash)) return
      setOpen(true)
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView?.({ block: 'nearest' })
      })
    }
    openForHash()
    window.addEventListener('hashchange', openForHash)
    return () => window.removeEventListener('hashchange', openForHash)
  }, [sectionIds])

  return (
    <details
      ref={ref}
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      className={cn(
        'group shrink-0 rounded-card border border-border/45 bg-card/50 shadow-card',
        className
      )}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden
        />
        {REPORT_COPY.reviewContext.title}
        <span className="truncate text-xs font-normal text-muted-foreground">
          {REPORT_COPY.reviewContext.hint}
        </span>
      </summary>
      <div className="space-y-5 border-t border-border/40 px-4 py-4">{children}</div>
    </details>
  )
}
