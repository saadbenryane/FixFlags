'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      <Button
        variant="outline"
        asChild
        className="min-h-12"
      >
        <Link
          href="/samples"
          onClick={() => trackEvent('clicked_sample_cta', { placement: 'sample_section' })}
        >
          {label}
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      </Button>
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
      className="inline-flex min-h-11 items-center gap-2 py-1 text-sm font-semibold text-brand transition-colors hover:text-brand-hover"
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}
