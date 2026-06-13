'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { FindingCard } from './FindingCard'
import { AreaPromptButton } from './AreaPromptButton'
import { GradeBadge } from './GradeBadge'
import { areaLabel } from '@/lib/utils'
import { ChevronDown, ChevronUp, Lock } from 'lucide-react'
import { UPSELLS } from '@/lib/marketing/copy'
import { FREE_FINDING_LIMIT } from '@/lib/audit/access'

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
  grade: string
  score: number | null
  status: string
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
  isPaid?: boolean
  defaultOpen?: boolean
  showFeedback?: boolean
}

export function AreaCard({
  area,
  isPaid = false,
  defaultOpen = false,
  showFeedback = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const visibleFindings = isPaid
    ? area.findings
    : area.findings.slice(0, FREE_FINDING_LIMIT)
  const hiddenCount = area.findings.length - FREE_FINDING_LIMIT
  const findingCount = area.findings.length

  return (
    <Card id={`area-${area.name}`} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-start justify-between gap-4 text-left w-full"
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <GradeBadge grade={area.grade} score={area.score} size="md" />
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
        <CardContent className="pt-0 space-y-3">
          {area.findings.length > 0 && (
            <div className="flex items-center justify-end flex-wrap gap-2">
              {isPaid ? (
                <AreaPromptButton
                  areaPrompt={area.areaPrompt}
                  cursorPrompt={area.cursorPrompt}
                  claudePrompt={area.claudePrompt}
                  lovablePrompt={area.lovablePrompt}
                  boltPrompt={area.boltPrompt}
                />
              ) : (
                <Link
                  href="/pricing"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-1"
                >
                  <Lock className="h-3 w-3" />
                  {UPSELLS.areaGate.areaPrompt}
                </Link>
              )}
            </div>
          )}

          <div className="rounded-lg overflow-hidden border border-border/60">
            {visibleFindings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                showFeedback={showFeedback}
                variant="row"
              />
            ))}
          </div>

          {!isPaid && hiddenCount > 0 && (
            <div className="rounded-lg border-2 border-dashed border-muted p-4 text-center space-y-2">
              <p className="text-sm font-medium">
                {UPSELLS.areaGate.hiddenFindings(hiddenCount)}
              </p>
              <p className="text-xs text-muted-foreground">{UPSELLS.areaGate.upgradeBody}</p>
            </div>
          )}

          {area.findings.length === 0 && area.grade === 'A' && (
            <p className="text-sm text-grade-A font-medium">✓ No issues found in this area</p>
          )}

          {area.findings.length === 0 && area.grade !== 'A' && (
            <p className="text-sm text-muted-foreground">
              No individual findings listed — see the area summary above for what to improve.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
