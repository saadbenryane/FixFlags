import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft, Cpu } from 'lucide-react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Container } from '@/components/ui/container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { Surface } from '@/components/ui/surface'
import { Callout } from '@/components/ui/callout'

async function loadAnalytics(userId: string) {
  const now = new Date()
  const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [total, last7d, last30d, successful, failed, recentFailures, toolCounts] =
    await Promise.all([
      prisma.mcpInteraction.count({ where: { userId } }),
      prisma.mcpInteraction.count({ where: { userId, createdAt: { gte: days7 } } }),
      prisma.mcpInteraction.count({ where: { userId, createdAt: { gte: days30 } } }),
      prisma.mcpInteraction.count({ where: { userId, success: true } }),
      prisma.mcpInteraction.count({ where: { userId, success: false } }),
      prisma.mcpInteraction.findMany({
        where: { userId, success: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { method: true, tool: true, errorCode: true, createdAt: true, durationMs: true },
      }),
      prisma.mcpInteraction.groupBy({
        by: ['tool'],
        where: { userId, tool: { not: null } },
        _count: true,
        orderBy: { _count: { tool: 'desc' } },
      }),
    ])

  const avgDurationResult = await prisma.mcpInteraction.aggregate({
    where: { userId, durationMs: { not: null } },
    _avg: { durationMs: true },
  })

  return {
    total,
    last7d,
    last30d,
    successful,
    failed,
    recentFailures,
    toolCounts,
    avgDuration: avgDurationResult._avg.durationMs
      ? Math.round(avgDurationResult._avg.durationMs)
      : null,
  }
}

export default async function McpAnalyticsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session!.user.id

  let analytics: Awaited<ReturnType<typeof loadAnalytics>> | null = null
  let loadError = false
  try {
    analytics = await loadAnalytics(userId)
  } catch {
    loadError = true
  }

  const total = analytics?.total ?? 0
  const last7d = analytics?.last7d ?? 0
  const last30d = analytics?.last30d ?? 0
  const successful = analytics?.successful ?? 0
  const failed = analytics?.failed ?? 0
  const recentFailures = analytics?.recentFailures ?? []
  const toolCounts = analytics?.toolCounts ?? []
  const avgDuration = analytics?.avgDuration ?? null

  const totalOk = successful + failed
  const successRate = totalOk > 0 ? Math.round((successful / totalOk) * 100) : 0
  const maxToolCount = Math.max(...toolCounts.map((t) => t._count), 1)

  return (
    <Container variant="narrow" className="py-8 space-y-8">
      <PageHeader
        title="MCP Analytics"
        description="API call volume from your editor. Dashboard MCP counts track completed audits; this page tracks every MCP request."
      >
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to dashboard
        </Link>
      </PageHeader>

      {loadError && (
        <Callout variant="warning" title="Could not load analytics">
          Try refreshing the page. Your MCP connection is unaffected.
        </Callout>
      )}

      <Surface variant="nested" className="space-y-6 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                All time
              </p>
              <p className="text-2xl font-semibold tabular-nums">{total}</p>
              <p className="text-[10px] text-muted-foreground">MCP calls</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Last 7 days
              </p>
              <p className="text-2xl font-semibold tabular-nums">{last7d}</p>
              <p className="text-[10px] text-muted-foreground">calls</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Last 30 days
              </p>
              <p className="text-2xl font-semibold tabular-nums">{last30d}</p>
              <p className="text-[10px] text-muted-foreground">calls</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Success rate
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {totalOk > 0 ? `${successRate}%` : '-'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {successful} ok / {failed} failed
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Avg duration
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {avgDuration !== null ? `${avgDuration}ms` : '-'}
              </p>
              <p className="text-[10px] text-muted-foreground">per call</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="h-4 w-4 text-brand" />
              Tool usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {toolCounts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tool calls recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {toolCounts.map((t) => {
                  const pct = Math.round((t._count / maxToolCount) * 100)
                  return (
                    <div key={t.tool ?? 'unknown'} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <code className="font-mono">{t.tool}</code>
                        <span className="text-muted-foreground tabular-nums">{t._count}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted/40">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {recentFailures.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                Recent failures
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentFailures.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-red-100 bg-red-50/50 px-3 py-2 dark:border-red-900 dark:bg-red-950/20"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <code className="font-mono text-[10px]">
                        {f.method}
                        {f.tool ? `:${f.tool}` : ''}
                      </code>
                      <span className="text-muted-foreground">
                        {f.createdAt.toLocaleString()}
                      </span>
                    </div>
                    {f.errorCode && (
                      <p className="mt-0.5 text-[10px] font-mono text-red-600 dark:text-red-400">
                        {f.errorCode}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {total === 0 && !loadError && (
          <Card>
            <CardContent className="p-8 text-center">
              <Cpu className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No MCP calls yet. Use the MCP setup wizard to connect your editor, then run your first check via MCP.
              </p>
            </CardContent>
          </Card>
        )}
      </Surface>
    </Container>
  )
}
