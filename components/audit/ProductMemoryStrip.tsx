'use client'

import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'
import type { VerifiedLearning } from '@/lib/audit/product-intelligence'

interface ProductMemoryStripProps {
  auditId: string
  verifiedLearnings?: VerifiedLearning[]
  intentionalNotes?: string[]
  knownRisks?: string[]
}

/**
 * Surfaces Project Product Intelligence "Remember" state on the report.
 * One job: show what we proved fixed (and optional intentional / known risks).
 */
export function ProductMemoryStrip({
  auditId,
  verifiedLearnings = [],
  intentionalNotes = [],
  knownRisks = [],
}: ProductMemoryStripProps) {
  const hasLearnings = verifiedLearnings.length > 0
  const hasNotes = intentionalNotes.length > 0 || knownRisks.length > 0
  const visible = hasLearnings || hasNotes

  useEffect(() => {
    if (!visible || !hasLearnings) return
    trackEvent('remember_shown', {
      audit_id: auditId,
      learning_count: verifiedLearnings.length,
    })
  }, [auditId, hasLearnings, visible, verifiedLearnings.length])

  if (!visible) return null

  return (
    <section
      id="report-remember"
      aria-labelledby="report-remember-heading"
      className="space-y-3"
    >
      <div>
        <h2
          id="report-remember-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          {REPORT_COPY.sectionTitles.remember ?? 'What we proved'}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {REPORT_COPY.sectionTitles.rememberHint ??
            'Verified on re-check. Stays with this product across scans.'}
        </p>
      </div>
      {hasLearnings ? (
        <Card className="space-y-2 p-4 sm:p-5">
          <ul className="space-y-2">
            {verifiedLearnings.map((learning) => (
              <li
                key={`${learning.auditId}-${learning.at}-${learning.summary.slice(0, 24)}`}
                className="flex gap-2 text-sm leading-snug text-pretty"
              >
                <CheckCircle2
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                  aria-hidden
                />
                <span>{learning.summary}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {intentionalNotes.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Intentional: {intentionalNotes.slice(0, 3).join(' · ')}
        </p>
      ) : null}
      {knownRisks.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Accepted for now: {knownRisks.slice(0, 3).join(' · ')}
        </p>
      ) : null}
    </section>
  )
}
