import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionTitle } from '@/components/ui/typography'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'

function planPriceUsd(plan: keyof typeof PLAN_DEFINITIONS): number {
  return Number(PLAN_DEFINITIONS[plan].price.replace(/[^0-9.]/g, '')) || 0
}

function StatValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-2xl font-medium tabular-nums">{children}</div>
  )
}

function FunnelBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
      <span className="font-mono text-sm tabular-nums w-20 text-right">{value.toLocaleString()}</span>
      <span className="font-mono text-xs text-muted-foreground tabular-nums w-14 text-right">
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function startOf(daysAgo: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d
}

export default async function AdminAnalyticsPage() {
  const todayStart = startOf(0)
  const weekAgo = startOf(7)
  const monthAgo = startOf(30)

  const [
    totalUsers,
    usersWeek,
    usersMonth,
    usersWithAudits,
    usersWithCompletedAudits,
    paidUsers,
    paidUsersWeek,
    paidUsersMonth,
    auditsToday,
    auditsWeek,
    auditsMonth,
    totalAudits,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.user.count({ where: { audits: { some: {} } } }),
    prisma.user.count({ where: { audits: { some: { status: 'COMPLETED' } } } }),
    prisma.user.count({ where: { plan: { not: 'FREE' } } }),
    prisma.user.count({ where: { plan: { not: 'FREE' }, createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { plan: { not: 'FREE' }, createdAt: { gte: monthAgo } } }),
    prisma.audit.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.audit.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.audit.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.audit.count(),
  ])

  const [activePaidUsers, churnedThisMonth, completedAuditsMonth, trafficSources] =
    await Promise.all([
      prisma.user.findMany({
        where: { plan: { not: 'FREE' }, subscriptionStatus: { in: ['ACTIVE', 'TRIALING'] } },
        select: { plan: true },
      }),
      prisma.user.count({
        where: { subscriptionStatus: 'CANCELED', updatedAt: { gte: monthAgo } },
      }),
      prisma.audit.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: monthAgo }, startedAt: { not: null }, completedAt: { not: null } },
        select: { startedAt: true, completedAt: true },
      }),
      prisma.audit.groupBy({
        by: ['utmSource'],
        _count: { _all: true },
        where: { createdAt: { gte: monthAgo } },
        orderBy: { _count: { utmSource: 'desc' } },
      }),
    ])

  const mrr = activePaidUsers.reduce(
    (sum, u) => sum + planPriceUsd(u.plan as keyof typeof PLAN_DEFINITIONS),
    0
  )
  const paidUserCount = activePaidUsers.length
  // Approximation: churn = canceled this month / (currently active + canceled this month).
  // A precise cohort-based churn rate needs a subscription-event history table, not yet tracked.
  const churnRate =
    paidUserCount + churnedThisMonth > 0
      ? (churnedThisMonth / (paidUserCount + churnedThisMonth)) * 100
      : 0

  const avgAuditDurationSeconds =
    completedAuditsMonth.length > 0
      ? completedAuditsMonth.reduce((sum, a) => {
          const ms = a.completedAt!.getTime() - a.startedAt!.getTime()
          return sum + ms / 1000
        }, 0) / completedAuditsMonth.length
      : null

  const trafficSourceRows = trafficSources
    .map((row) => ({ source: row.utmSource || 'Direct / unknown', count: row._count._all }))
    .slice(0, 8)

  const funnelMax = Math.max(totalUsers, usersWithAudits, paidUsers, totalAudits, 1)

  const periodStats = [
    {
      label: 'Today',
      audits: auditsToday,
      users: null,
      paid: null,
    },
    {
      label: 'Last 7 days',
      audits: auditsWeek,
      users: usersWeek,
      paid: paidUsersWeek,
    },
    {
      label: 'Last 30 days',
      audits: auditsMonth,
      users: usersMonth,
      paid: paidUsersMonth,
    },
  ]

  return (
    <Container variant="report" className="py-8 space-y-8">
      <PageHeader title="Funnel analytics">
        <Link
          href="https://analytics.google.com"
          target="_blank"
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Open GA4 dashboard &rarr;
        </Link>
      </PageHeader>

      <section className="space-y-4">
        <SectionTitle>Conversion funnel (all time)</SectionTitle>
        <div className="space-y-2">
          <FunnelBar value={totalUsers} max={funnelMax} label="Total users" />
          <FunnelBar value={usersWithAudits} max={funnelMax} label="Started an audit" />
          <FunnelBar value={usersWithCompletedAudits} max={funnelMax} label="Completed an audit" />
          <FunnelBar value={paidUsers} max={funnelMax} label="Paid users" />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Revenue (current)</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">MRR</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>${mrr.toLocaleString()}</StatValue>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">Active paying customers</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>{paidUserCount.toLocaleString()}</StatValue>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">Churn rate (30d, approx.)</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>{churnRate.toFixed(1)}%</StatValue>
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground">
          Churn rate is canceled-this-month over (active + canceled-this-month) &mdash; an approximation.
          New/expansion/churned MRR broken out by cohort needs a subscription-event history table, which
          doesn&rsquo;t exist yet.
        </p>
      </section>

      <section className="space-y-4">
        <SectionTitle>Period breakdown</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {periodStats.map((p) => (
            <Card key={p.label} className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-medium">{p.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground">Audits</span>
                  <StatValue>{p.audits.toLocaleString()}</StatValue>
                </div>
                {p.users !== null && (
                  <div>
                    <span className="text-xs text-muted-foreground">New users</span>
                    <StatValue>{p.users.toLocaleString()}</StatValue>
                  </div>
                )}
                {p.paid !== null && (
                  <div>
                    <span className="text-xs text-muted-foreground">New paid</span>
                    <StatValue>{p.paid.toLocaleString()}</StatValue>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Product (last 30 days)</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">Avg audit duration</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>
                {avgAuditDurationSeconds === null ? '—' : `${avgAuditDurationSeconds.toFixed(1)}s`}
              </StatValue>
              <span className="text-xs text-muted-foreground">Target: under 30s</span>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">Completed audits</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>{completedAuditsMonth.length.toLocaleString()}</StatValue>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Traffic sources (last 30 days, by audit UTM source)</SectionTitle>
        <div className="rounded-card bg-muted/30 p-4 text-sm space-y-2">
          {trafficSourceRows.length === 0 ? (
            <p className="text-muted-foreground">No audits in this period.</p>
          ) : (
            trafficSourceRows.map((row) => (
              <div key={row.source} className="flex items-center justify-between">
                <span className="text-muted-foreground">{row.source}</span>
                <span className="font-mono tabular-nums">{row.count.toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>GA4 events tracked</SectionTitle>
        <div className="rounded-card bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
          <p><code className="text-foreground font-mono text-xs">started_audit</code> &mdash; User submitted a URL</p>
          <p><code className="text-foreground font-mono text-xs">signed_up</code> &mdash; Account created</p>
          <p><code className="text-foreground font-mono text-xs">signed_in</code> &mdash; User signed in</p>
          <p><code className="text-foreground font-mono text-xs">viewed_pricing</code> &mdash; Pricing page viewed</p>
          <p><code className="text-foreground font-mono text-xs">started_checkout</code> &mdash; Upgrade button clicked</p>
          <p><code className="text-foreground font-mono text-xs">completed_checkout</code> &mdash; Stripe checkout succeeded</p>
          <p><code className="text-foreground font-mono text-xs">audit_completed</code> &mdash; Audit finished processing</p>
          <p><code className="text-foreground font-mono text-xs">audit_limit_reached</code> &mdash; Free tier limit hit</p>
          <p><code className="text-foreground font-mono text-xs">fix_prompt_copied</code> &mdash; Fix prompt copied to clipboard</p>
          <p><code className="text-foreground font-mono text-xs">viewed_report</code> &mdash; Completed report viewed</p>
        </div>
      </section>
    </Container>
  )
}
