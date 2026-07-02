import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionTitle } from '@/components/ui/typography'
import { AUDIT_CAPABILITIES, capabilitySummary, type AuditDimension } from '@/lib/audit/capability-matrix'

/** docs/offering.md, docs/business-model.md: feature freeze lifts at 100 paying users */
const PAYING_USER_FREEZE_THRESHOLD = 100

function StatValue({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-2xl font-medium tabular-nums">{children}</div>
}

function startOf(daysAgo: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d
}

function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

export default async function OperatingPlanPage() {
  const monthAgo = startOf(30)

  const [
    paidUsers,
    completedRootAuditsMonth,
    rechecksMonth,
    flagStatusCounts,
    launchReadinessCounts,
  ] = await Promise.all([
    prisma.user.count({ where: { plan: { not: 'FREE' } } }),
    prisma.audit.count({
      where: { status: 'COMPLETED', parentId: null, createdAt: { gte: monthAgo } },
    }),
    prisma.audit.count({
      where: { status: 'COMPLETED', parentId: { not: null }, createdAt: { gte: monthAgo } },
    }),
    prisma.flag.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { audit: { createdAt: { gte: monthAgo } } },
    }),
    prisma.audit.groupBy({
      by: ['launchReadinessState'],
      _count: { id: true },
      where: { status: 'COMPLETED', createdAt: { gte: monthAgo } },
    }),
  ])

  const freezePct = Math.min(100, pct(paidUsers, PAYING_USER_FREEZE_THRESHOLD))
  const featureFreezeActive = paidUsers < PAYING_USER_FREEZE_THRESHOLD

  const recheckRate = pct(rechecksMonth, completedRootAuditsMonth)

  const flagMap = Object.fromEntries(flagStatusCounts.map((f) => [f.status, f._count.id]))
  const totalFlagsMonth = flagStatusCounts.reduce((sum, f) => sum + f._count.id, 0)
  const fixedFlags = flagMap['FIXED'] ?? 0
  const regressedFlags = flagMap['REGRESSED'] ?? 0
  const openFlags = flagMap['OPEN'] ?? 0

  const readinessMap = Object.fromEntries(
    launchReadinessCounts.map((r) => [r.launchReadinessState, r._count.id])
  )
  const totalReadinessAudits = launchReadinessCounts.reduce((sum, r) => sum + r._count.id, 0)
  const readinessRows = [
    { label: 'Safe to ship', key: 'SAFE', value: readinessMap['SAFE'] ?? 0 },
    { label: 'Fix first', key: 'FIX_FIRST', value: readinessMap['FIX_FIRST'] ?? 0 },
    { label: 'Not ready', key: 'NOT_READY', value: readinessMap['NOT_READY'] ?? 0 },
    { label: 'Unknown', key: 'UNKNOWN', value: readinessMap['UNKNOWN'] ?? 0 },
  ]

  const capSummary = capabilitySummary()
  const dimensions: AuditDimension[] = ['MESSAGE', 'EXPERIENCE', 'REACH']
  const byDimension = dimensions.map((dim) => {
    const caps = AUDIT_CAPABILITIES.filter((c) => c.dimension === dim)
    return {
      dimension: dim,
      live: caps.filter((c) => c.status === 'live').length,
      partial: caps.filter((c) => c.status === 'partial').length,
      planned: caps.filter((c) => c.status === 'planned').length,
      total: caps.length,
    }
  })

  return (
    <Container variant="report" className="py-8 space-y-8">
      <PageHeader title="Operating plan" />

      <section className="space-y-4">
        <SectionTitle>Feature freeze gate</SectionTitle>
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs text-muted-foreground font-medium">
              Paying users toward the {PAYING_USER_FREEZE_THRESHOLD}-user threshold
            </CardTitle>
            <Badge variant={featureFreezeActive ? 'secondary' : 'default'}>
              {featureFreezeActive ? 'Freeze active' : 'Freeze lifted'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatValue>
              {paidUsers.toLocaleString()} / {PAYING_USER_FREEZE_THRESHOLD}
            </StatValue>
            <Progress value={freezePct} />
            <p className="text-xs text-muted-foreground">
              docs/offering.md: &ldquo;Zero new features until 100 paying users&rdquo; &mdash; scan depth
              (Phase 1, scan-roadmap.md) is the validated exception.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionTitle>Core loop health (30d) &mdash; Flag, Fix, Re-check</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">Re-check rate</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>{recheckRate}%</StatValue>
              <p className="text-xs text-muted-foreground mt-1">
                {rechecksMonth.toLocaleString()} rechecks / {completedRootAuditsMonth.toLocaleString()} completed audits
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">Flags fixed</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>{pct(fixedFlags, totalFlagsMonth)}%</StatValue>
              <p className="text-xs text-muted-foreground mt-1">{fixedFlags.toLocaleString()} of {totalFlagsMonth.toLocaleString()} flags</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">Flags open</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>{openFlags.toLocaleString()}</StatValue>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">Flags regressed</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>{regressedFlags.toLocaleString()}</StatValue>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Launch readiness distribution (30d)</SectionTitle>
        <Card className="border-0 shadow-card">
          <CardContent className="py-4 space-y-2">
            {readinessRows.map((r) => (
              <div key={r.key} className="flex items-center gap-3">
                <span className="w-28 text-sm text-muted-foreground shrink-0">{r.label}</span>
                <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all"
                    style={{ width: `${Math.max(pct(r.value, totalReadinessAudits), r.value > 0 ? 1 : 0)}%` }}
                  />
                </div>
                <span className="font-mono text-sm tabular-nums w-14 text-right">{r.value.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionTitle>Scan roadmap build-out</SectionTitle>
        <p className="text-xs text-muted-foreground">
          Live from <code className="font-mono">lib/audit/capability-matrix.ts</code> (source of truth for
          docs/scan-roadmap.md) &mdash; run <code className="font-mono">npm run audit:capabilities</code> for the full breakdown.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">Live</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>{capSummary.byStatus.live}</StatValue>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">Partial</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>{capSummary.byStatus.partial}</StatValue>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">Planned</CardTitle>
            </CardHeader>
            <CardContent>
              <StatValue>{capSummary.byStatus.planned}</StatValue>
            </CardContent>
          </Card>
        </div>
        {capSummary.unmapped.length > 0 && (
          <p className="text-xs text-destructive">
            {capSummary.unmapped.length} check id(s) not mapped to a capability: {capSummary.unmapped.join(', ')}
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {byDimension.map((d) => (
            <Card key={d.dimension} className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-medium">{d.dimension}</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2 flex-wrap">
                <Badge variant="default" size="sm">{d.live} live</Badge>
                {d.partial > 0 && <Badge variant="secondary" size="sm">{d.partial} partial</Badge>}
                {d.planned > 0 && <Badge variant="outline" size="sm">{d.planned} planned</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>Reference docs</SectionTitle>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
          <span>docs/offering.md</span>
          <span>docs/business-model.md</span>
          <span>docs/scan-roadmap.md</span>
          <Link href="/admin/analytics" className="underline hover:text-foreground">/admin/analytics &rarr;</Link>
        </div>
      </section>
    </Container>
  )
}
