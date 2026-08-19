'use client'

import { useCallback, useEffect, useState } from 'react'
import type { EvidenceHighlight } from '@/lib/audit/evidence-highlights'
import {
  computeLetterboxLayout,
  mapHighlightToLetterbox,
  normalizedPercent,
  type LetterboxLayout,
} from '@/lib/audit/highlight-geometry'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export function useLetterboxLayout(
  panel: HTMLElement | null,
  image: HTMLImageElement | null
): LetterboxLayout | undefined {
  const [layout, setLayout] = useState<LetterboxLayout | undefined>()

  const update = useCallback(() => {
    if (!panel || !image?.naturalWidth || !image.naturalHeight) return
    if (panel.clientWidth <= 0 || panel.clientHeight <= 0) return
    setLayout(
      computeLetterboxLayout(
        image.naturalWidth / image.naturalHeight,
        panel.clientWidth / panel.clientHeight
      )
    )
  }, [panel, image])

  useEffect(() => {
    update()
    if (!panel || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => update())
    observer.observe(panel)
    return () => observer.disconnect()
  }, [panel, update])

  return layout
}

export function EvidenceChip({
  highlight,
  className,
}: {
  highlight?: Pick<EvidenceHighlight, 'scope' | 'measured' | 'visualTarget'>
  className?: string
}) {
  if (!highlight) return null
  const message =
    highlight.scope === 'page'
      ? REPORT_COPY.reportFirst.pageScopeEvidence
      : highlight.measured
        ? highlight.visualTarget
        : REPORT_COPY.reportFirst.unmeasuredElement
  if (highlight.scope === 'element' && highlight.measured) return null

  return (
    <p
      className={cn(
        'pointer-events-none absolute left-3 top-3 z-overlay max-w-[min(20rem,calc(100%-1.5rem))] rounded-md border border-border/60 bg-background/95 px-2.5 py-1.5 text-2xs font-medium text-foreground shadow-sm backdrop-blur',
        className
      )}
    >
      {message}
    </p>
  )
}

export function EvidenceSpotlight({
  highlight,
  layout,
  selected = true,
}: {
  highlight: EvidenceHighlight
  layout?: LetterboxLayout
  selected?: boolean
}) {
  if (!selected || highlight.scope !== 'element' || !highlight.measured) return null

  const isCritical = highlight.severity === 'CRITICAL'
  const rect = layout ? mapHighlightToLetterbox(highlight, layout) : highlight

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className={cn(
          'absolute rounded-[5px]',
          isCritical
            ? 'shadow-[0_0_0_9999px_hsl(var(--foreground)/0.42),0_0_0_2px_hsl(var(--destructive))]'
            : 'shadow-[0_0_0_9999px_hsl(var(--foreground)/0.42),0_0_0_2px_hsl(var(--brand))]'
        )}
        style={{
          left: normalizedPercent(rect.x),
          top: normalizedPercent(rect.y),
          width: normalizedPercent(rect.width),
          height: normalizedPercent(rect.height),
        }}
      />
      <span
        className={cn(
          'absolute max-w-[12rem] truncate rounded-md px-1.5 py-0.5 text-2xs font-medium text-background',
          isCritical ? 'bg-destructive' : 'bg-brand'
        )}
        style={{
          left: normalizedPercent(rect.x),
          top: `calc(${normalizedPercent(rect.y)} - 1.4rem)`,
        }}
      >
        {highlight.visualTarget}
      </span>
    </div>
  )
}
