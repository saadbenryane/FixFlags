import { prisma } from '@/lib/db'
import { UserTable } from '@/components/admin/UserTable'
import { formatUsd } from '@/lib/billing/costs'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
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
  })

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
      <UserTable users={rows} />
    </Container>
  )
}
