'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import { ScoreDisplay } from '@/components/audit/ScoreDisplay'
import { ScoreSparkline } from '@/components/audit/ScoreSparkline'
import { SectionTitle } from '@/components/ui/typography'
import { ExternalLink, ArrowLeftRight, Check, X, AlertTriangle, Loader2 } from 'lucide-react'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { computeRubricsFromRows } from '@/lib/audit/rubric'
import { rubricLabel } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface AuditItem {
  id: string
  url: string
  status: string
  score: number | null
  createdAt: string | Date
  rubrics: Array<{
    name: string
    grade: string | null
    score: number | null
    flags: Array<{ severity: string }>
  }>
  monitoringAudits: Array<{
    id: string
    score: number | null
    createdAt: string | Date
  }>
}

interface RecentChecksListProps {
  audits: AuditItem[]
  canCompare: boolean
  bestScore: number | null
  worstScore: number | null
}

export function RecentChecksList({
  audits: initialAudits,
  canCompare,
  bestScore,
  worstScore,
}: RecentChecksListProps) {
  const [audits, setAudits] = useState(initialAudits)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const completedAudits = audits.filter((a) => a.status === 'COMPLETED')
  const scores = completedAudits.map((a) => a.score).filter((s): s is number => s !== null)

  const loadMore = async () => {
    if (loading || !hasMore) return
    setLoading(true)
    const cursor = audits[audits.length - 1]?.id
    try {
      const res = await fetch(`/api/recent-checks?cursor=${cursor}`)
      if (!res.ok) throw new Error('Failed to load more')
      const data = await res.json()
      setAudits((prev) => [...prev, ...data.audits])
      setHasMore(data.hasMore)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>Recent checks</SectionTitle>
        {scores.length > 0 && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            {bestScore !== null && (
              <span className="tabular-nums">
                Best: <span className="font-medium text-foreground">{bestScore}</span>
              </span>
            )}
            {worstScore !== null && (
              <span className="tabular-nums">
                Worst: <span className="font-medium text-foreground">{worstScore}</span>
              </span>
            )}
          </div>
        )}
      </div>
      {audits.map((audit) => {
        const isCompleted = audit.status === 'COMPLETED'
        const rubrics = isCompleted
          ? computeRubricsFromRows(
              audit.rubrics.map((r) => ({
                name: r.name,
                grade: r.grade,
                score: r.score,
                flags: r.flags.map((f) => ({ severity: f.severity })),
              }))
            )
          : []
        const rubricMap = new Map(rubrics.map((r) => [r.name, r]))
        const statusLabel =
          audit.status === 'FAILED'
            ? 'Failed'
            : audit.status === 'COMPLETED'
              ? null
              : 'In progress'

        const trendScores = isCompleted
          ? [
              audit.score,
              ...audit.monitoringAudits.map((r) => r.score),
            ].filter((s): s is number => s !== null)
          : []

        const criticalFlags = isCompleted
          ? audit.rubrics.flatMap((r) => r.flags.filter((f) => f.severity === 'CRITICAL')).length
          : 0
        const importantFlags = isCompleted
          ? audit.rubrics.flatMap((r) => r.flags.filter((f) => f.severity === 'IMPORTANT')).length
          : 0

        return (
          <Link key={audit.id} href={`/report/${audit.id}`} className="block group">
            <Card interactive>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {isCompleted && (
                    <div className="shrink-0">
                      <ScoreDisplay
                        score={audit.score}
                        grade={null}
                        variant="compact"
                        size="sm"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{audit.url}</span>
                      {statusLabel ? (
                        <Badge
                          variant={audit.status === 'FAILED' ? 'destructive' : 'secondary'}
                          size="sm"
                          className={audit.status !== 'FAILED' ? 'text-muted-foreground' : undefined}
                        >
                          {statusLabel}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{new Date(audit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {criticalFlags > 0 && (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {criticalFlags} critical
                        </span>
                      )}
                      {importantFlags > 0 && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          {importantFlags} important
                        </span>
                      )}
                    </div>
                    {trendScores.length > 1 && (
                      <ScoreSparkline scores={trendScores} className="mt-1" />
                    )}
                  </div>
                  {isCompleted && (
                    <div className="flex gap-1 shrink-0">
                      {RUBRIC_ORDER.map((name) => {
                        const r = rubricMap.get(name)
                        if (!r) return null
                        return (
                          <span key={name} title={rubricLabel(name)}>
                            <RubricStatusBadge
                              status={r.status}
                              size="sm"
                              label={
                                r.status === 'PASS' ? (
                                  <Check className="h-3 w-3" aria-hidden />
                                ) : r.status === 'BLOCKED' ? (
                                  <X className="h-3 w-3" aria-hidden />
                                ) : (
                                  <AlertTriangle className="h-3 w-3" aria-hidden />
                                )
                              }
                            />
                          </span>
                        )
                      })}
                      {audit.monitoringAudits.length > 0 && canCompare && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
                          <ArrowLeftRight className="h-3 w-3" />
                          Trend
                        </span>
                      )}
                    </div>
                  )}
                  <ExternalLink className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
