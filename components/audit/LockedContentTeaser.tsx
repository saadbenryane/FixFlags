'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportSignupCta, trackReportSignupCta } from '@/components/audit/ReportSignupCta'
import { LOCKED_CONTENT_TEASER } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface LockedContentTeaserProps {
  label?: string
  signUpHref?: string
  signInHref?: string
  /** Analytics origin for the signup click. */
  from?: 'value_strip' | 'sample_fix'
  /**
   * Inline lock line for repeated gates (one per locked Flag). Only the
   * report-level gate carries the full pair of buttons.
   */
  compact?: boolean
  className?: string
}

export function LockedContentTeaser({
  label = LOCKED_CONTENT_TEASER.defaultLabel,
  signUpHref = '/sign-up',
  signInHref = '/sign-in',
  from = 'value_strip',
  compact = false,
  className,
}: LockedContentTeaserProps) {
  if (compact) {
    return (
      <p
        className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-inner)] border border-dashed border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground',
          className
        )}
      >
        <Lock className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-pretty">{label}</span>
        <Link
          href={signUpHref as Route}
          onClick={() => trackReportSignupCta(from)}
          className="font-medium text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {LOCKED_CONTENT_TEASER.primaryCta}
        </Link>
      </p>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-inner)] border border-dashed border-border/50 bg-muted/20 px-4 py-3',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-pretty">{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ReportSignupCta href={signUpHref} from={from} size="sm">
          {LOCKED_CONTENT_TEASER.primaryCta}
        </ReportSignupCta>
        <Button asChild variant="ghost" size="sm">
          <Link href={signInHref as Route}>{LOCKED_CONTENT_TEASER.secondaryCta}</Link>
        </Button>
      </div>
    </div>
  )
}
