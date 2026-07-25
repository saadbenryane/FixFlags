'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/events'
import { LANDING_PAGE } from '@/lib/marketing/copy'

/** Tracks when the homepage sample explorer enters the viewport once. */
export function SampleViewTracker({ placement = 'homepage' }: { placement?: 'homepage' | 'samples' }) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    const target = document.getElementById('sample-review')
    if (!target) {
      trackEvent('viewed_sample', { placement })
      fired.current = true
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (fired.current) return
        if (entries.some((entry) => entry.isIntersecting)) {
          trackEvent('viewed_sample', { placement })
          fired.current = true
          observer.disconnect()
        }
      },
      { threshold: 0.35 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [placement])

  return null
}

export function SampleSectionCta({ flagCount }: { flagCount?: number }) {
  const label =
    typeof flagCount === 'number' && flagCount > 0
      ? LANDING_PAGE.sampleReport.ctaWithCount(flagCount)
      : LANDING_PAGE.sampleReport.cta

  return (
    <div>
      <Link
        href="/samples"
        onClick={() => trackEvent('clicked_sample_cta', { placement: 'sample_section' })}
        className="inline-flex min-h-12 items-center gap-2.5 rounded-[var(--radius-control)] border border-border/60 bg-background px-6 py-3 text-sm font-semibold text-foreground shadow-[0_1px_2px_hsl(240_8%_5%/0.04),0_8px_20px_-12px_hsl(240_8%_5%/0.14)] transition-[background-color,border-color,box-shadow] duration-200 hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {label}
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  )
}

export function HowItWorksSampleLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      href={href as Route}
      onClick={() => trackEvent('clicked_sample_cta', { placement: 'how_it_works' })}
      className="inline-flex min-h-10 items-center gap-2 py-1 text-sm font-semibold text-brand transition-colors hover:text-brand-hover"
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}
