import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionTitle } from '@/components/ui/typography'
import { formatUsd, sumEstimatedCost } from '@/lib/billing/costs'

function StatValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-2xl font-medium tabular-nums">{children}</div>
  )
}

function startOf(daysAgo: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d
}

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
  ])

  const planMap = Object.fromEntries(planCounts.map((p) => [p.plan, p._count.id]))
  const avgCost = completedWithCost > 0 ? costAllTime / completedWithCost : 0
  const totalTokens =
    (tokenAgg._sum.llmInputTokens ?? 0) + (tokenAgg._sum.llmOutputTokens ?? 0)

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
    { label: 'Avg cost / audit', value: formatUsd(avgCost) },
    { label: 'LLM tokens (in+out)', value: totalTokens.toLocaleString() },
  ]

  const plans = [
    { label: 'Free', value: planMap['FREE'] ?? 0 },
    { label: 'Pro', value: planMap['BUILDER'] ?? 0 },
    { label: 'Agency', value: planMap['TEAM'] ?? 0 },
    { label: 'Studio', value: planMap['STUDIO'] ?? 0 },
  ]

  return (
    <Container variant="report" className="py-8 space-y-8">
      <PageHeader title="Admin metrics" />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>{s.value}</StatValue>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-4">
        <SectionTitle>Estimated run costs</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {costStats.map((s) => (
            <Card key={s.label} className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-medium">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <StatValue>{s.value}</StatValue>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Admin tools</SectionTitle>
        <Button variant="outline" asChild>
          <Link href="/admin/expert-reviews">Expert Review orders</Link>
        </Button>
      </section>

      <section className="space-y-4">
        <SectionTitle>Plan breakdown</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {plans.map((p) => (
            <Card key={p.label} className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-medium">{p.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <StatValue>{p.value.toLocaleString()}</StatValue>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </Container>
  )
}
