import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionTitle } from '@/components/ui/typography'
import { StatValue } from '@/components/admin/StatValue'
import { MetricCard } from '@/components/admin/MetricCard'
import { startOf, pct } from '@/lib/admin/date-ranges'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { subscriptionMetrics } from '@/lib/analytics/subscription-metrics'

function planPriceUsd(plan: keyof typeof PLAN_DEFINITIONS): number {
  return Number(PLAN_DEFINITIONS[plan].price.replace(/[^0-9.]/g, '')) || 0
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
    anonAuditsMonth,
    anonCompletedMonth,
    anonUnlinkedLeads,
    improvedAttemptsMonth,
    watchedProducts,
    productsWithSecondCycle,
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
    prisma.audit.count({ where: { userId: null, createdAt: { gte: monthAgo } } }),
    prisma.audit.count({
      where: { userId: null, status: 'COMPLETED', createdAt: { gte: monthAgo } },
    }),
    prisma.lead.count({ where: { linkedUserId: null } }),
    prisma.improvementAttempt.findMany({
      where: { outcome: 'IMPROVED', updatedAt: { gte: monthAgo } },
      select: {
        createdAt: true,
        updatedAt: true,
        verificationAudit: {
          select: { runCost: { select: { estimatedCostUsd: true } } },
        },
      },
    }),
    prisma.project.count({ where: { watchInterval: { not: null } } }),
    prisma.project.count({
      where: {
        improvements: {
          some: {
            attempts: { some: { outcome: 'IMPROVED' } },
          },
        },
        audits: { some: { parentId: { not: null }, status: 'COMPLETED' } },
      },
    }),
  ])

  const [
    activePaidUsers,
    subscriptionTransitions,
    firstSubscriptionEvent,
    completedAuditsMonth,
    trafficSources,
  ] =
    await Promise.all([
      prisma.user.findMany({
        where: { plan: { not: 'FREE' }, subscriptionStatus: { in: ['ACTIVE', 'TRIALING'] } },
        select: { plan: true },
      }),
      prisma.subscriptionLifecycleEvent.findMany({
        where: { occurredAt: { gte: monthAgo } },
        select: {
          userId: true,
          previousPlan: true,
          plan: true,
          occurredAt: true,
        },
        orderBy: { occurredAt: 'asc' },
      }),
      prisma.subscriptionLifecycleEvent.findFirst({
        select: { occurredAt: true },
        orderBy: { occurredAt: 'asc' },
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
  const hasCompleteLifecycleWindow =
    firstSubscriptionEvent !== null && firstSubscriptionEvent.occurredAt <= monthAgo
  const { newMrr, expansionMrr, churnedMrr, churnedUsers, churnRate } =
    subscriptionMetrics(subscriptionTransitions, paidUserCount, hasCompleteLifecycleWindow)

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

  const loggedInAuditsMonth = Math.max(0, auditsMonth - anonAuditsMonth)
  const anonCompleteRate = pct(anonCompletedMonth, anonAuditsMonth)
  const verifiedImprovementCount = improvedAttemptsMonth.length
  const verificationCost = improvedAttemptsMonth.reduce(
    (sum, attempt) =>
      sum + Number(attempt.verificationAudit?.runCost?.estimatedCostUsd ?? 0),
    0
  )
  const costPerVerifiedImprovement =
    verifiedImprovementCount > 0 ? verificationCost / verifiedImprovementCount : null
  const averageTimeToVerifiedHours =
    verifiedImprovementCount > 0
      ? improvedAttemptsMonth.reduce(
          (sum, attempt) => sum + (attempt.updatedAt.getTime() - attempt.createdAt.getTime()),
          0
        ) /
        verifiedImprovementCount /
        3_600_000
      : null

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
        <SectionTitle>Continuous improvement (last 30 days)</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Verified improvements"
            value={verifiedImprovementCount.toLocaleString()}
            variant="subtle"
          />
          <MetricCard
            label="Cost per verified improvement"
            value={costPerVerifiedImprovement === null ? 'N/A' : `$${costPerVerifiedImprovement.toFixed(2)}`}
            variant="subtle"
          />
          <MetricCard
            label="Time to verified outcome"
            value={averageTimeToVerifiedHours === null ? 'N/A' : `${averageTimeToVerifiedHours.toFixed(1)}h`}
            variant="subtle"
          />
          <MetricCard
            label="Products with a second cycle"
            value={productsWithSecondCycle.toLocaleString()}
            detail={<span className="text-xs text-muted-foreground">{watchedProducts} under Watch</span>}
            variant="subtle"
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Anonymous report conversion (last 30 days)</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Anonymous checks started"
            value={anonAuditsMonth.toLocaleString()}
            variant="subtle"
          />
          <MetricCard
            label="Anonymous checks completed"
            value={anonCompletedMonth.toLocaleString()}
            detail={<span className="text-xs text-muted-foreground">{anonCompleteRate}% of starts</span>}
            variant="subtle"
          />
          <MetricCard
            label="Signed-in checks started"
            value={loggedInAuditsMonth.toLocaleString()}
            variant="subtle"
          />
          <MetricCard
            label="Unlinked leads (domains)"
            value={anonUnlinkedLeads.toLocaleString()}
            action={
              <Link href="/admin/leads" className="text-xs text-brand underline">
                Open leads &rarr;
              </Link>
            }
            variant="subtle"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Anonymous checks have no account when created. Account conversion is tracked in GA4 through{' '}
          <code className="font-mono text-foreground">report_signup_cta_clicked</code> and{' '}
          <code className="font-mono text-foreground">audits_claimed</code>.
        </p>
      </section>

      <section className="space-y-4">
        <SectionTitle>Account and check totals (all time)</SectionTitle>
        <p className="max-w-3xl text-sm text-muted-foreground">
          These are independent database totals, not sequential funnel steps. Use the GA4 event funnel for stage-to-stage conversion.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total accounts', value: totalUsers },
            { label: 'Accounts with a check', value: usersWithAudits },
            { label: 'Accounts with a completed check', value: usersWithCompletedAudits },
            { label: 'Paid accounts', value: paidUsers },
          ].map((item) => (
            <MetricCard
              key={item.label}
              label={item.label}
              value={item.value.toLocaleString()}
              variant="subtle"
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Revenue (current)</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="MRR" value={`$${mrr.toLocaleString()}`} variant="subtle" />
          <MetricCard
            label="Active paying customers"
            value={paidUserCount.toLocaleString()}
            variant="subtle"
          />
          <MetricCard
            label="New + expansion MRR (30d)"
            value={`$${(newMrr + expansionMrr).toLocaleString()}`}
            detail={<span className="text-xs text-muted-foreground">${newMrr} new · ${expansionMrr} expansion</span>}
            variant="subtle"
          />
          <MetricCard
            label="Churn (30d)"
            value={churnRate === null ? 'N/A' : `${churnRate.toFixed(1)}%`}
            detail={<span className="text-xs text-muted-foreground">{churnedUsers} accounts · ${churnedMrr} MRR</span>}
            variant="subtle"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Revenue transitions come from idempotent Stripe lifecycle events. Churn remains N/A until a
          complete 30-day event window exists; historical transitions are not invented during migration.
        </p>
      </section>

      <section className="space-y-4">
        <SectionTitle>Period breakdown</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {periodStats.map((p) => (
            <Card key={p.label} variant="solid">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-medium">{p.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground">Checks</span>
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
          <MetricCard
            label="Average check duration"
            value={avgAuditDurationSeconds === null ? 'N/A' : `${avgAuditDurationSeconds.toFixed(1)}s`}
            detail={<span className="text-xs text-muted-foreground">Target: under 30s</span>}
            variant="subtle"
          />
          <MetricCard
            label="Completed checks"
            value={completedAuditsMonth.length.toLocaleString()}
            variant="subtle"
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Traffic sources (last 30 days, by check UTM source)</SectionTitle>
        <div className="rounded-card bg-muted/30 p-4 text-sm space-y-2">
          {trafficSourceRows.length === 0 ? (
            <p className="text-muted-foreground">No checks in this period.</p>
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
          <p><code className="text-foreground font-mono text-xs">landing_view</code>: Homepage viewed</p>
          <p><code className="text-foreground font-mono text-xs">started_audit</code>: User submitted a URL (scan_submitted)</p>
          <p><code className="text-foreground font-mono text-xs">scan_validation_failed</code>: Client URL validation failed</p>
          <p><code className="text-foreground font-mono text-xs">signup_started</code>: Email focus or OAuth click on sign-up</p>
          <p><code className="text-foreground font-mono text-xs">signed_up</code>: Account created</p>
          <p><code className="text-foreground font-mono text-xs">signed_in</code>: User signed in</p>
          <p><code className="text-foreground font-mono text-xs">viewed_pricing</code>: Pricing page viewed</p>
          <p><code className="text-foreground font-mono text-xs">started_checkout</code>: Upgrade button clicked</p>
          <p><code className="text-foreground font-mono text-xs">completed_checkout</code>: Stripe checkout succeeded</p>
          <p><code className="text-foreground font-mono text-xs">audit_completed</code>: Check finished processing</p>
          <p><code className="text-foreground font-mono text-xs">first_finding_viewed</code>: Top Flag shown in explorer</p>
          <p><code className="text-foreground font-mono text-xs">audit_limit_reached</code>: Free check limit reached</p>
          <p><code className="text-foreground font-mono text-xs">fix_prompt_copied</code>: Fix prompt copied to clipboard</p>
          <p><code className="text-foreground font-mono text-xs">recheck_started</code>: Owner started a re-check</p>
          <p><code className="text-foreground font-mono text-xs">recheck_completed</code>: Re-check result viewed (compare page or report diff strip)</p>
          <p><code className="text-foreground font-mono text-xs">audit_intent</code>: Landing URL field focused (hero/final CTA)</p>
          <p><code className="text-foreground font-mono text-xs">viewed_report</code>: Completed report viewed</p>
          <p><code className="text-foreground font-mono text-xs">viewed_sample</code>: Sample report section viewed</p>
          <p><code className="text-foreground font-mono text-xs">clicked_sample_cta</code>: Sample CTA clicked</p>
          <p><code className="text-foreground font-mono text-xs">report_signup_cta_clicked</code>: Report signup CTA (value strip, sample fix, claim guide, limit gate)</p>
          <p><code className="text-foreground font-mono text-xs">audits_claimed</code>: Anonymous reports saved after signup</p>
          <p className="pt-2 text-xs text-muted-foreground">
            Key events (GA4 Admin): run <code className="font-mono text-foreground">npm run growth:configure-ga4-key-events</code> after deploying tracking changes.
            Canonical list lives in <code className="font-mono text-foreground">lib/growth/ga-key-events.ts</code>.
          </p>
        </div>
      </section>
    </Container>
  )
}
