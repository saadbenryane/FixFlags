import type { Route } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionTitle } from '@/components/ui/typography'
import { formatUsd, sumEstimatedCost, getCostOutliers } from '@/lib/billing/costs'
import { getAdminUnreadCount } from '@/lib/live-support/sessions'
import { MarginPanel } from '@/components/admin/MarginPanel'
import { MetricCard } from '@/components/admin/MetricCard'
import { startOf } from '@/lib/admin/date-ranges'

export default async function AdminPage() {
  const weekAgo = startOf(7)
  const todayStart = startOf(0)

  const [
    totalAudits,
    auditsToday,
    auditsThisWeek,
    failedLast24h,
    activeUsers,
    planCounts,
    costAllTime,
    costToday,
    costWeek,
    tokenAgg,
    completedWithCost,
    newLeadsWeek,
    qualifiedLeads,
    openChatSessions,
    inboxUnread,
    costOutliers,
  ] = await Promise.all([
    prisma.audit.count(),
    prisma.audit.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.audit.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.audit.count({ where: { status: 'FAILED', createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    prisma.user.count({ where: { audits: { some: { createdAt: { gte: weekAgo } } } } }),
    prisma.user.groupBy({ by: ['plan'], _count: { id: true } }),
    sumEstimatedCost(),
    sumEstimatedCost({ createdAt: { gte: todayStart } }),
    sumEstimatedCost({ createdAt: { gte: weekAgo } }),
    prisma.auditRunCost.aggregate({
      _sum: { llmInputTokens: true, llmOutputTokens: true },
    }),
    prisma.auditRunCost.count(),
    prisma.lead.count({ where: { firstSeenAt: { gte: weekAgo } } }),
    prisma.lead.count({ where: { status: 'QUALIFIED' } }),
    prisma.supportSession.count({
      where: { status: { in: ['OPEN', 'WAITING', 'ACTIVE'] } },
    }),
    getAdminUnreadCount(),
    getCostOutliers(7),
  ])

  const planMap = Object.fromEntries(planCounts.map((p) => [p.plan, p._count.id]))
  const avgCost = completedWithCost > 0 ? costAllTime / completedWithCost : 0
  const costPerScanToday = auditsToday > 0 ? costToday / auditsToday : 0
  const costPerScanWeek = auditsThisWeek > 0 ? costWeek / auditsThisWeek : 0
  const totalTokens =
    (tokenAgg._sum.llmInputTokens ?? 0) + (tokenAgg._sum.llmOutputTokens ?? 0)

  const opsStats = [
    { label: 'New leads (7d)', value: newLeadsWeek.toLocaleString(), href: '/admin/leads' },
    { label: 'Qualified leads', value: qualifiedLeads.toLocaleString(), href: '/admin/leads' },
    { label: 'Open chat sessions', value: openChatSessions.toLocaleString(), href: '/admin/feedback?tab=conversations' },
    { label: 'Inbox unread', value: inboxUnread.toLocaleString(), href: '/admin/feedback?tab=conversations' },
  ]

  const stats = [
    { label: 'Total audits', value: totalAudits.toLocaleString() },
    { label: 'Audits today', value: auditsToday.toLocaleString() },
    { label: 'Audits this week', value: auditsThisWeek.toLocaleString() },
    { label: 'Failed (24h)', value: failedLast24h.toLocaleString() },
    { label: 'Active users (7d)', value: activeUsers.toLocaleString() },
  ]

  const costStats = [
    { label: 'Est. cost (all time)', value: formatUsd(costAllTime) },
    { label: 'Est. cost (today)', value: formatUsd(costToday) },
    { label: 'Est. cost (7d)', value: formatUsd(costWeek) },
    { label: 'Cost / scan (today)', value: formatUsd(costPerScanToday) },
    { label: 'Cost / scan (7d)', value: formatUsd(costPerScanWeek) },
    { label: 'Avg cost / audit', value: formatUsd(avgCost) },
    { label: 'LLM tokens (in+out)', value: totalTokens.toLocaleString() },
  ]

  const plans = [
    { label: 'Free', value: planMap['FREE'] ?? 0 },
    { label: 'Pro', value: planMap['BUILDER'] ?? 0 },
    { label: 'Studio', value: planMap['TEAM'] ?? 0 },
  ]

  return (
    <Container variant="report" className="py-8 space-y-8">
      <PageHeader title="Admin metrics" />

      <section className="space-y-4">
        <SectionTitle>Customer ops</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {opsStats.map((s) => (
            <MetricCard
              key={s.label}
              label={s.label}
              value={s.value}
              action={
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link href={s.href as Route}>View</Link>
                </Button>
              }
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <MetricCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      <section className="space-y-4">
        <SectionTitle>Estimated run costs</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {costStats.map((s) => (
            <MetricCard key={s.label} label={s.label} value={s.value} />
          ))
        }
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Admin tools</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/feedback">Feedback &amp; Support</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/leads">Leads</Link>
          </Button>
        </div>
      </section>

      <MarginPanel />

      <section className="space-y-4">
        <SectionTitle>Plan breakdown</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          {plans.map((p) => (
            <MetricCard key={p.label} label={p.label} value={p.value.toLocaleString()} />
          ))}
        </div>
      </section>

      {costOutliers.length > 0 && (
        <section className="space-y-4">
          <SectionTitle>Most expensive scans (7d)</SectionTitle>
          <Card variant="solid" className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Domain</th>
                  <th className="text-left px-4 py-3 font-medium">Model</th>
                  <th className="text-right px-4 py-3 font-medium">Cost</th>
                  <th className="text-right px-4 py-3 font-medium">Input</th>
                  <th className="text-right px-4 py-3 font-medium">Output</th>
                </tr>
              </thead>
              <tbody>
                {costOutliers.map((o) => (
                  <tr key={o.auditId} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-[240px]">{o.domain}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{o.model ?? '-'}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-xs">{formatUsd(o.estimatedCostUsd)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-muted-foreground">{o.inputTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-muted-foreground">{o.outputTokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}
    </Container>
  )
}
