import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatUsd } from '@/lib/billing/costs'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { parsePipelineLog } from '@/lib/audit/pipeline-log'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { computeShareStatusFromRubrics, computeRubricsFromRows } from '@/lib/audit/rubric'
import { rubricLabel, rubricStatusColor, shareStatusLabel, shareStatusColor } from '@/lib/utils'

export default async function AdminAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const audit = await prisma.audit.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, plan: true } },
      runCost: true,
      rubrics: {
        select: {
          name: true,
          grade: true,
          score: true,
          flags: { select: { severity: true } },
        },
      },
    },
  })

  if (!audit) notFound()

  const events = parsePipelineLog(audit.pipelineLog)

  return (
    <Container variant="report" className="py-8 space-y-6">
      <PageHeader title="Audit detail" description={audit.url}>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/report/${audit.id}`}>View report</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/audits/${audit.id}/logs`} download>Download logs</a>
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{audit.status}</Badge>
        <Badge variant="secondary">v{audit.pipelineVersion ?? PIPELINE_VERSION}</Badge>
        {audit.failureCode && <Badge variant="destructive">{audit.failureCode}</Badge>}
      </div>

      {audit.rubrics.length > 0 && (() => {
        const rubricSources = audit.rubrics.map((r) => ({
          name: r.name,
          grade: r.grade,
          score: r.score,
          flags: r.flags.map((f) => ({ severity: f.severity })),
        }))
        const rubrics = computeRubricsFromRows(rubricSources)
        const shareStatus = computeShareStatusFromRubrics(rubricSources)
        return (
          <div className="flex flex-wrap gap-2">
            <Badge className={shareStatusColor(shareStatus)}>
              {shareStatusLabel(shareStatus)}
            </Badge>
            {RUBRIC_ORDER.map((name) => {
              const r = rubrics.find((rr) => rr.name === name)
              if (!r) return null
              return (
                <Badge key={name} className={rubricStatusColor(r.status)}>
                  {rubricLabel(name)}: {r.status}
                </Badge>
              )
            })}
          </div>
        )
      })()}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Run cost</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {audit.runCost ? (
              <>
                <p>Est. cost: <strong>{formatUsd(audit.runCost.estimatedCostUsd)}</strong></p>
                <p className="text-muted-foreground">
                  {audit.runCost.llmInputTokens.toLocaleString()} in /{' '}
                  {audit.runCost.llmOutputTokens.toLocaleString()} out tokens
                </p>
                <p className="text-muted-foreground">Model: {audit.runCost.llmModel ?? '-'}</p>
                <p className="text-muted-foreground">
                  Duration: {(audit.runCost.durationMs / 1000).toFixed(1)}s · PageSpeed calls:{' '}
                  {audit.runCost.pagespeedCalls}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No cost data (incomplete or not finalized)</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-mono text-xs break-all">{audit.id}</p>
            <p className="text-muted-foreground">User: {audit.user?.email ?? 'Anonymous'}</p>
            <p className="text-muted-foreground">Plan: {audit.user?.plan ?? '-'}</p>
            {audit.errorMsg && (
              <p className="text-destructive text-xs mt-2">{audit.errorMsg}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {events.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline events ({events.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs font-mono max-h-64 overflow-y-auto">
              {events.map((e, i) => (
                <li key={i} className="text-muted-foreground">
                  {e.ts} · {e.stage} · {e.event}
                  {e.durationMs ? ` (${e.durationMs}ms)` : ''}
                  {e.error ? ` - ${e.error}` : ''}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/audits">← Back to audits</Link>
      </Button>
    </Container>
  )
}
