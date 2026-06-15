'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { FindingCard } from './FindingCard'
import { AreaPromptButton } from './AreaPromptButton'
import { ScoreDisplay } from './ScoreDisplay'
import { areaLabel } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'

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

interface Area {
  id: string
  name: string
  grade: string | null
  score: number | null
  status: string | null
  summary: string
  areaPrompt: string
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  findings: Finding[]
}

interface Props {
  area: Area
  defaultOpen?: boolean
  showFeedback?: boolean
}

export function AreaCard({
  area,
  defaultOpen = false,
  showFeedback = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const findingCount = area.findings.length

  return (
    <Card id={`area-${area.name}`} className="scroll-mt-[var(--header-offset)] border-0 shadow-card">
      <CardHeader className="pb-3">
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={`area-panel-${area.name}`}
          className="flex min-h-11 w-full items-start justify-between gap-4 text-left"
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <ScoreDisplay
              areaName={area.name}
              grade={area.grade}
              score={area.score}
              variant="compact"
              size="md"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{areaLabel(area.name)}</span>
                {!open && findingCount > 0 && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    {findingCount} finding{findingCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-snug mt-0.5 text-pretty">
                {area.summary}
              </p>
            </div>
          </div>
          {open ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
          )}
        </button>
      </CardHeader>

      {open && (
        <CardContent id={`area-panel-${area.name}`} className="pt-0 space-y-3">
          {area.findings.length > 0 && (
            <div className="flex items-center justify-end flex-wrap gap-2">
              <AreaPromptButton
                areaPrompt={area.areaPrompt}
                cursorPrompt={area.cursorPrompt}
                claudePrompt={area.claudePrompt}
                lovablePrompt={area.lovablePrompt}
                boltPrompt={area.boltPrompt}
              />
            </div>
          )}

          <div className="rounded-lg overflow-hidden border border-border/60">
            {area.findings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                showFeedback={showFeedback}
                variant="row"
              />
            ))}
          </div>

          {area.findings.length === 0 && area.grade === 'A' && (
            <p className="text-sm text-grade-A font-medium">✓ No issues found in this area</p>
          )}

          {area.findings.length === 0 && area.grade === null && (
            <p className="text-sm text-muted-foreground">
              This area could not be assessed from the available evidence.
            </p>
          )}

          {area.findings.length === 0 && area.grade !== null && area.grade !== 'A' && (
            <p className="text-sm text-muted-foreground">
              No individual findings listed, see the area summary above for what to improve.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
