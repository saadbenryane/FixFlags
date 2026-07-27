import { prisma } from '@/lib/db'
import { UserTable } from '@/components/admin/UserTable'
import { formatUsd } from '@/lib/billing/costs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function AdminUsersPage() {
  const [
    users,
    creditStats,
    creditsByUser,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        role: true,
        auditsUsed: true,
        auditsLimit: true,
        createdAt: true,
        audits: {
          where: { status: 'COMPLETED' },
          select: {
            runCost: { select: { estimatedCostUsd: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.creditPurchase.aggregate({
      where: { status: 'PAID' },
      _count: true,
      _sum: { creditsPurchased: true, priceUsdCents: true },
    }),
    prisma.creditPurchase.groupBy({
      by: ['userId'],
      where: { status: 'PAID' },
      _sum: { creditsRemaining: true },
    }),
  ])

  const rows = users.map((user) => {
    const totalCostUsd = user.audits.reduce(
      (sum, audit) => sum + (audit.runCost?.estimatedCostUsd.toNumber() ?? 0),
      0
    )
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      role: user.role,
      auditsUsed: user.auditsUsed,
      auditsLimit: user.auditsLimit,
      createdAt: user.createdAt,
      totalCostLabel: formatUsd(totalCostUsd),
    }
  })

  return (
    <Container variant="wide" className="space-y-6 py-8">
      <PageHeader title={`Users (${rows.length})`} />

      <Card variant="solid">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Credit history</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Total purchases</span>
            <div className="font-mono text-2xl font-medium tabular-nums">{creditStats._count}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Total credits sold</span>
            <div className="font-mono text-2xl font-medium tabular-nums">{(creditStats._sum.creditsPurchased ?? 0).toLocaleString()}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Revenue from packs</span>
            <div className="font-mono text-2xl font-medium tabular-nums">{formatUsd((creditStats._sum.priceUsdCents ?? 0) / 100)}</div>
          </div>
        </CardContent>
      </Card>

      {(creditsByUser.length > 0) && (
        <Card variant="solid" className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">User ID</th>
                <th className="text-right px-4 py-3 font-medium">Purchased credits remaining</th>
              </tr>
            </thead>
            <tbody>
              {creditsByUser.sort((a, b) => ((b._sum.creditsRemaining ?? 0) - (a._sum.creditsRemaining ?? 0))).map((c) => (
                <tr key={c.userId} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{c.userId.slice(0, 12)}…</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{c._sum.creditsRemaining ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <UserTable users={rows} />
    </Container>
  )
}
