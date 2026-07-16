'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SeverityBadge } from '@/components/audit/SeverityBadge'
import { TextLink } from '@/components/ui/text-link'
import { rubricLabel } from '@/lib/utils'

export interface ReportReactionItem {
  id: string
  vote: number
  comment: string | null
  domain: string
  auditId: string
  createdAt: string
}

export interface FlagReactionGroup {
  key: string
  problem: string
  checkId: string | null
  rubric: string
  severity: string
  evidence: string
  sampleAuditId: string
  up: number
  down: number
  comments: string[]
}

interface Props {
  reportSummary: { up: number; down: number; total: number }
  reportComments: ReportReactionItem[]
  flagGroups: FlagReactionGroup[]
}

function VotePill({ up, down }: { up: number; down: number }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
      <span className="inline-flex items-center gap-1 text-success">
        <ThumbsUp className="h-3.5 w-3.5" />
        {up}
      </span>
      <span className="inline-flex items-center gap-1 text-destructive">
        <ThumbsDown className="h-3.5 w-3.5" />
        {down}
      </span>
    </div>
  )
}

export function ReactionsList({ reportSummary, reportComments, flagGroups }: Props) {
  const [flagFilter, setFlagFilter] = useState<'downvoted' | 'all'>('downvoted')

  const visibleFlagGroups = (
    flagFilter === 'downvoted' ? flagGroups.filter((g) => g.down > 0) : flagGroups
  ).slice().sort((a, b) => b.down - a.down || b.up - a.up)

  return (
    <div className="space-y-8">
      {/* Report-level reactions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Report reactions: “Was this report useful?”</h3>
          <VotePill up={reportSummary.up} down={reportSummary.down} />
        </div>
        {reportComments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {reportSummary.total === 0
              ? 'No report reactions yet.'
              : 'No written comments yet, only quick 👍/👎 so far.'}
          </p>
        ) : (
          <div className="space-y-2">
            {reportComments.map((r) => (
              <Card key={r.id} variant="solid" className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {r.vote > 0 ? (
                      <ThumbsUp className="h-4 w-4 text-success" />
                    ) : (
                      <ThumbsDown className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-xs text-muted-foreground">{r.domain}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {r.comment && <p className="text-sm">{r.comment}</p>}
                <TextLink href={`/report/${r.auditId}`} className="text-xs">
                  View report &rarr;
                </TextLink>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Flag-level reactions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Flag reactions</h3>
          <div className="flex gap-1">
            {(['downvoted', 'all'] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={flagFilter === f ? 'default' : 'ghost'}
                onClick={() => setFlagFilter(f)}
                className="text-xs capitalize"
              >
                {f === 'downvoted' ? '👎 Downvoted' : 'All'}
              </Button>
            ))}
          </div>
        </div>

        {visibleFlagGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flag reactions in this view.</p>
        ) : (
          <div className="space-y-2">
            {visibleFlagGroups.map((g) => (
              <Card key={g.key} variant="solid" className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={g.severity} />
                    <Badge variant="outline" className="text-xs">
                      {rubricLabel(g.rubric)}
                    </Badge>
                    {g.checkId && (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{g.checkId}</code>
                    )}
                  </div>
                  <VotePill up={g.up} down={g.down} />
                </div>
                <div className="text-sm font-medium">{g.problem}</div>
                <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded truncate">
                  {g.evidence}
                </div>
                {g.comments.length > 0 && (
                  <ul className="space-y-1 border-l-2 border-border pl-3">
                    {g.comments.map((c, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        “{c}”
                      </li>
                    ))}
                  </ul>
                )}
                <TextLink href={`/admin/audits/${g.sampleAuditId}`} className="text-xs">
                  View source audit &rarr;
                </TextLink>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
