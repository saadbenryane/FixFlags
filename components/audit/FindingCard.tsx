'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PromptCopyButton } from './PromptCopyButton'
import { FindingFeedback } from './FindingFeedback'
import { cn, severityColor } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { UPSELLS } from '@/lib/marketing/copy'

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
  blurred?: boolean
}

export function FindingCard({ finding, blurred }: Props) {
  const [expanded, setExpanded] = useState(false)

  const bestPrompt =
    finding.agentPrompt ??
    finding.fix

  return (
    <div className={cn('rounded-lg border bg-card relative', blurred && 'select-none')}>
      <div
        className={cn('px-4 py-3', blurred && 'blur-sm pointer-events-none')}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <Badge className={cn('text-xs shrink-0 mt-0.5', severityColor(finding.severity))}>
              {finding.severity}
            </Badge>
            <span className="text-sm font-medium leading-snug">{finding.problem}</span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-3 border-t pt-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Evidence</div>
              <p className="text-sm text-foreground/80 font-mono text-xs bg-muted px-2 py-1.5 rounded">
                {finding.evidence}
              </p>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Why it matters</div>
              <p className="text-sm text-foreground/80">{finding.whyItMatters}</p>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Fix</div>
              <p className="text-sm text-foreground/80">{finding.fix}</p>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <PromptCopyButton prompt={bestPrompt} label="Copy fix prompt" />
              <FindingFeedback findingId={finding.id} />
            </div>
          </div>
        )}
      </div>

      {blurred && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[2px]">
          <Button size="sm" variant="outline">
            {UPSELLS.areaGate.unlockReport}
          </Button>
        </div>
      )}
    </div>
  )
}
