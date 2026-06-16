'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { PromptCopyButton } from './PromptCopyButton'
import { FlagFeedback } from './FlagFeedback'
import { Card } from '@/components/ui/card'
import { resolveFixPrompt, type RankableFlag } from '@/lib/audit/priority-flags'
import { rubricLabel, severityLabel, impactTagLabel } from '@/lib/utils'

interface Props {
  flag: RankableFlag
  showFeedback?: boolean
  variant?: 'card' | 'row'
  defaultExpanded?: boolean
}

function bestFixPrompt(flag: RankableFlag): string {
  return resolveFixPrompt(flag) ?? flag.problem
}

function metaLine(flag: RankableFlag): string {
  const parts = [rubricLabel(flag.rubric), severityLabel(flag.severity)]
  const impact = impactTagLabel(flag.impactTag)
  if (impact) parts.push(impact)
  return parts.join(' · ')
}

export function FlagCard({
  flag,
  showFeedback = true,
  variant = 'row',
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const fixPrompt = bestFixPrompt(flag)

  const content = (
    <FlagRowContent
      flag={flag}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      fixPrompt={fixPrompt}
      showFeedback={showFeedback}
    />
  )

  if (variant === 'card') {
    return <Card className="relative">{content}</Card>
  }

  return (
    <div className="relative border-b border-border/60 last:border-b-0">{content}</div>
  )
}

function FlagRowContent({
  flag,
  expanded,
  onToggle,
  fixPrompt,
  showFeedback,
}: {
  flag: RankableFlag
  expanded: boolean
  onToggle: () => void
  fixPrompt: string
  showFeedback: boolean
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
            {metaLine(flag)}
          </p>
          <p className="text-sm font-medium leading-snug text-pretty">{flag.problem}</p>
          {flag.confidence != null && flag.confidence < 0.8 && (
            <p className="text-[10px] text-muted-foreground">
              Lower confidence ({Math.round(flag.confidence * 100)}%), verify before acting
            </p>
          )}
          {flag.pageUrl && (
            <p className="text-[10px] text-muted-foreground truncate">{flag.pageUrl}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <PromptCopyButton prompt={fixPrompt} label="Copy fix prompt" compact />
          <button
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-l border-border/60 pl-3 ml-0.5">
          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-label text-muted-foreground">
              Where
            </p>
            <p className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1.5 rounded-md leading-relaxed">
              {flag.evidence ?? 'No evidence captured.'}
            </p>
          </div>

          {flag.whyItMatters && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-label text-muted-foreground">
                Why
              </p>
              <p className="text-sm text-foreground/80 text-pretty">{flag.whyItMatters}</p>
            </div>
          )}

          {flag.fix && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-label text-muted-foreground">
                Fix
              </p>
              <p className="text-sm text-foreground/90 text-pretty">{flag.fix}</p>
            </div>
          )}

          <FixPromptBlock prompt={fixPrompt} rows={4} clamp={false} />

          {(flag.severity === 'CRITICAL' || flag.severity === 'IMPORTANT') &&
            flag.verificationRule && (
              <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-label text-muted-foreground">
                  How to verify
                </p>
                <p className="text-sm text-foreground/90">{flag.verificationRule}</p>
              </div>
            )}

          {showFeedback && <FlagFeedback flagId={flag.id} />}
        </div>
      )}
    </div>
  )
}
