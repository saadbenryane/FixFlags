'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { FlagEvidenceScreenshot } from '@/components/audit/FlagEvidenceScreenshot'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { FlagFeedback } from './FlagFeedback'
import { Card } from '@/components/ui/card'
import { formatFlagEvidence, formatFlagFixPrompt } from '@/lib/audit/evidence-highlights'
import { resolveFixPrompt, type RankableFlag } from '@/lib/audit/priority-flags'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
import { rubricLabel, severityLabel, impactTagLabel } from '@/lib/utils'

interface Props {
  flag: RankableFlag
  flagIndex?: number
  screenshots?: AuditScreenshot[]
  reportHost?: string
  evidenceAnchors?: EvidenceAnchorMap
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
  flagIndex = 0,
  screenshots,
  reportHost,
  evidenceAnchors,
  showFeedback = true,
  variant = 'row',
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const fixPrompt = bestFixPrompt(flag)
  const displayFixPrompt = formatFlagFixPrompt(flag, fixPrompt)
  const hasScreenshots = Boolean(screenshots?.length && reportHost)

  const content = (
    <FlagRowContent
      flag={flag}
      flagIndex={flagIndex}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      fixPrompt={displayFixPrompt}
      copyPrompt={fixPrompt}
      showFeedback={showFeedback}
      screenshots={screenshots}
      reportHost={reportHost}
      evidenceAnchors={evidenceAnchors}
      hasScreenshots={hasScreenshots}
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
  flagIndex,
  expanded,
  onToggle,
  fixPrompt,
  copyPrompt,
  showFeedback,
  screenshots,
  reportHost,
  evidenceAnchors,
  hasScreenshots,
}: {
  flag: RankableFlag
  flagIndex: number
  expanded: boolean
  onToggle: () => void
  fixPrompt: string
  copyPrompt: string
  showFeedback: boolean
  screenshots?: AuditScreenshot[]
  reportHost?: string
  evidenceAnchors?: EvidenceAnchorMap
  hasScreenshots: boolean
}) {
  const evidenceText = formatFlagEvidence(flag)

  return (
    <div className="px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="meta-label text-muted-foreground/80">
            {metaLine(flag)}
          </p>
          <p className="text-sm font-medium leading-snug text-pretty">{flag.problem}</p>
          {flag.confidence != null && flag.confidence < 0.8 && (
            <p className="text-[10px] text-muted-foreground">
              Lower confidence ({Math.round(flag.confidence * 100)}%), verify before acting
            </p>
          )}
          {flag.pageUrl && (
            <p className="break-all text-[10px] text-muted-foreground sm:truncate">{flag.pageUrl}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1 sm:justify-start">
          <PromptCopyButton prompt={copyPrompt} label="Copy fix prompt" compact />
          <button
            onClick={onToggle}
            className="min-h-11 min-w-11 p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-l border-border/60 pl-3 ml-0.5">
          {hasScreenshots && screenshots && reportHost && (
            <FlagEvidenceScreenshot
              flag={flag}
              flagIndex={flagIndex}
              screenshots={screenshots}
              host={reportHost}
              evidenceAnchors={evidenceAnchors}
              className="mb-1"
            />
          )}

          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-label text-muted-foreground">
              Where
            </p>
            <p className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1.5 rounded-md leading-relaxed text-pretty">
              {evidenceText || 'No evidence captured.'}
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

          <FixPromptBlock prompt={fixPrompt} rows={4} clamp={false} nested />

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
