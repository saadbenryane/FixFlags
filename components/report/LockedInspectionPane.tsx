'use client'

import Link from 'next/link'
import { CheckCircle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SeverityBadge } from '@/components/audit/SeverityBadge'
import { LOCKED_INSPECTION } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface LockedInspectionPaneProps {
  flagTitle: string
  flagSeverity: string
  /** Sign-in URL that returns the user to this report after auth. */
  signInHref?: string
  /** Sign-up URL for new accounts (claim/return path). */
  signUpHref?: string
  className?: string
}

export function LockedInspectionPane({
  flagTitle,
  flagSeverity,
  signInHref = '/sign-in',
  signUpHref = '/sign-up',
  className,
}: LockedInspectionPaneProps) {
  return (
    <div
      className={cn(
        'animate-soft-reveal space-y-6 rounded-[var(--radius-inner)] border border-dashed border-border/40 bg-muted/10 p-6 sm:p-8',
        className
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-medium">{LOCKED_INSPECTION.headline}</h3>
        </div>
        <div className="flex items-center gap-2">
          <SeverityBadge severity={flagSeverity} />
          <span className="text-sm text-muted-foreground text-pretty">{flagTitle}</span>
        </div>
        <p className="text-sm text-muted-foreground text-pretty">{LOCKED_INSPECTION.body}</p>
      </div>

      <ul className="space-y-2">
        {LOCKED_INSPECTION.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-foreground/80">
            <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand/70" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="sm">
          <Link href={signInHref}>{LOCKED_INSPECTION.primaryCta}</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={signUpHref}>{LOCKED_INSPECTION.secondaryCta}</Link>
        </Button>
      </div>
    </div>
  )
}
