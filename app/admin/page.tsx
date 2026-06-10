import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function startOf(daysAgo: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d
}

export default async function AdminPage() {
  const [
    totalAudits,
    auditsToday,
    auditsThisWeek,
    failedLast24h,
    activeUsers,
    planCounts,
  ] = await Promise.all([
    prisma.audit.count(),
    prisma.audit.count({ where: { createdAt: { gte: startOf(0) } } }),
    prisma.audit.count({ where: { createdAt: { gte: startOf(7) } } }),
    prisma.audit.count({ where: { status: 'FAILED', createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    prisma.user.count({ where: { audits: { some: { createdAt: { gte: startOf(7) } } } } }),
    prisma.user.groupBy({ by: ['plan'], _count: { id: true } }),
  ])

  const planMap = Object.fromEntries(planCounts.map((p) => [p.plan, p._count.id]))

  const stats = [
    { label: 'Total audits', value: totalAudits },
    { label: 'Audits today', value: auditsToday },
    { label: 'Audits this week', value: auditsThisWeek },
    { label: 'Failed (24h)', value: failedLast24h },
    { label: 'Active users (7d)', value: activeUsers },
  ]

  const plans = [
    { label: 'Free', value: planMap['FREE'] ?? 0 },
    { label: 'Builder', value: planMap['BUILDER'] ?? 0 },
    { label: 'Team', value: planMap['TEAM'] ?? 0 },
    { label: 'Studio', value: planMap['STUDIO'] ?? 0 },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">Admin metrics</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-medium">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Plan breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {plans.map((p) => (
            <Card key={p.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-medium">{p.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{p.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
