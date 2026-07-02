'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/typography'
import { ScoreDisplay } from '@/components/audit/ScoreDisplay'
import { ScoreSparkline } from '@/components/audit/ScoreSparkline'
import type { DomainAuditHistory } from '@/lib/audit/domain-history'
import { TrendingDown, TrendingUp } from 'lucide-react'

interface Props {
  domains: DomainAuditHistory[]
}

export function DomainHistoryPanel({ domains }: Props) {
  if (domains.length === 0) return null

  return (
    <div className="space-y-3">
      <SectionTitle>Your sites over time</SectionTitle>
      <p className="text-sm text-muted-foreground text-pretty">
        Scan, fix, re-scan. Watch your score climb as issues get resolved.
      </p>
      {domains.slice(0, 6).map((domain) => {
        const scores = [...domain.audits]
          .reverse()
          .map((a) => a.score)
          .filter((s): s is number => s !== null)
        const delta = domain.scoreDelta

        return (
          <Link key={domain.normalizedDomain} href={`/report/${domain.audits[0]?.id}`}>
            <Card interactive>
              <CardContent className="py-3 px-4 flex items-center gap-3 flex-wrap">
                {domain.latestScore != null && (
                  <ScoreDisplay
                    score={domain.latestScore}
                    grade={null}
                    variant="compact"
                    size="sm"
                    className="shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{domain.normalizedDomain}</div>
                  <div className="text-xs text-muted-foreground">
                    {domain.audits.length} scan{domain.audits.length === 1 ? '' : 's'}
                  </div>
                  {scores.length > 1 && (
                    <ScoreSparkline scores={scores} className="mt-1" />
                  )}
                </div>
                {delta != null && delta !== 0 && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium ${
                      delta > 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {delta > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {delta > 0 ? '+' : ''}
                    {delta}
                  </span>
                )}
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
