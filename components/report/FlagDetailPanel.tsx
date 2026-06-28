'use client'

import type { ReactNode } from 'react'
import { ClipboardCheck, Lightbulb, ScanSearch, Sparkles, type LucideIcon } from 'lucide-react'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { FlagFeedback } from '@/components/audit/FlagFeedback'
import { LockedContentTeaser } from '@/components/audit/LockedContentTeaser'
import { SeverityBadge } from '@/components/audit/SeverityBadge'
import { RubricPill } from '@/components/marketing/sample/RubricDimensionHeader'
import type { ExplorerFlag } from '@/lib/report/explorer-model'
import { cn } from '@/lib/utils'

function FlagDetailCard({
  title,
  icon: Icon,
  children,
  emphasis = false,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
  emphasis?: boolean
}) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-inner)] border p-4 sm:p-5',
        emphasis ? 'border-brand/20 bg-brand/5' : 'border-border/40 bg-muted/15'
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', emphasis ? 'text-brand' : 'text-muted-foreground')} aria-hidden />
        <h4 className={cn('text-sm font-medium', emphasis ? 'text-brand' : 'text-foreground')}>{title}</h4>
      </div>
      {children}
    </section>
  )
}

export function FlagDetailPanel({
  flag,
  showFeedback = false,
  aiLocked = false,
  signUpHref,
}: {
  flag: ExplorerFlag
  showFeedback?: boolean
  aiLocked?: boolean
  signUpHref?: string
}) {
  return (
    <div key={flag.id} className="space-y-3 animate-soft-reveal" aria-live="polite">
      {flag.whyItMatters && (
        <FlagDetailCard title="Why it matters" icon={Lightbulb}>
          <p className="text-sm leading-relaxed text-foreground/90 text-pretty">{flag.whyItMatters}</p>
        </FlagDetailCard>
      )}

      {flag.evidence && (
        <FlagDetailCard title="Evidence" icon={ScanSearch}>
          <p className="text-sm leading-relaxed text-foreground/90 text-pretty">{flag.evidence}</p>
        </FlagDetailCard>
      )}

      {flag.verificationRule && (
        <FlagDetailCard title="How to verify" icon={ClipboardCheck}>
          <p className="text-sm leading-relaxed text-foreground/90 text-pretty">
            {flag.verificationRule}
          </p>
        </FlagDetailCard>
      )}

      {flag.hasFixPrompt && (
        <FlagDetailCard title="Fix" icon={Sparkles} emphasis>
          {aiLocked ? (
            <LockedContentTeaser
              label="Fix prompt - create a free account to view"
              signUpHref={signUpHref}
            />
          ) : (
            <FixPromptBlock
              prompt={flag.fixPrompt}
              clamp={false}
              showCursorAction
              variant="compact"
              nested
            />
          )}
        </FlagDetailCard>
      )}

      {showFeedback && <FlagFeedback flagId={flag.id} />}
    </div>
  )
}

export function FlagMetaPills({ flag }: { flag: ExplorerFlag }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RubricPill rubric={flag.rubric} label={flag.rubricLabel} />
      <SeverityBadge severity={flag.severity} />
      {flag.impactTag && (
        <span className="rounded-full bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground">
          {flag.impactTag}
        </span>
      )}
    </div>
  )
}
