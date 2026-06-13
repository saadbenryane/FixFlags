'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { SeverityBadge } from './SeverityBadge'
import { PromptCopyButton } from './PromptCopyButton'
import { FindingFeedback } from './FindingFeedback'
import { cn, areaLabel } from '@/lib/utils'

interface Finding {
  id: string
  severity: string
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  agentPrompt?: string | null
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
}

interface Props {
  finding: Finding
  areaName?: string
  showFeedback?: boolean
  variant?: 'card' | 'row'
}

export function FindingCard({
  finding,
  areaName,
  showFeedback = true,
  variant = 'row',
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const bestPrompt =
    finding.lovablePrompt ??
    finding.boltPrompt ??
    finding.cursorPrompt ??
    finding.agentPrompt ??
    finding.fix

  if (variant === 'card') {
    return (
      <div className="rounded-lg border bg-card relative">
        <FindingRowContent
          finding={finding}
          areaName={areaName}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
          bestPrompt={bestPrompt}
          showFeedback={showFeedback}
        />
      </div>
    )
  }

  return (
    <div className="relative border-b border-border/60 last:border-b-0">
      <FindingRowContent
        finding={finding}
        areaName={areaName}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        bestPrompt={bestPrompt}
        showFeedback={showFeedback}
      />
    </div>
  )
}

function FindingRowContent({
  finding,
  areaName,
  expanded,
  onToggle,
  bestPrompt,
  showFeedback,
}: {
  finding: Finding
  areaName?: string
  expanded: boolean
  onToggle: () => void
  bestPrompt: string
  showFeedback: boolean
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <SeverityBadge severity={finding.severity} className="mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1">
          {areaName && (
            <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
              {areaLabel(areaName)}
            </span>
          )}
          <p className="text-sm font-medium leading-snug text-pretty">{finding.problem}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <PromptCopyButton prompt={bestPrompt} label="Copy" compact />
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
        <div className="mt-3 ml-[calc(0.5rem+2px)] pl-3 border-l border-border/60 space-y-2">
          <p className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1.5 rounded-md leading-relaxed">
            {finding.evidence}
          </p>
          <p className="text-sm text-foreground/80 text-pretty">{finding.whyItMatters}</p>
          {showFeedback && <FindingFeedback findingId={finding.id} />}
        </div>
      )}
    </div>
  )
}
