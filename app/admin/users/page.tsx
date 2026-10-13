import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { prisma } from '@/lib/db'
import { UserTable } from '@/components/admin/UserTable'
import { formatUsd } from '@/lib/billing/costs'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { Prisma } from '@prisma/client'
import { AdminListSearch, AdminPagination } from '@/components/admin/AdminListControls'
import { readAdminListQuery, adminPagination } from '@/lib/admin/list-query'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  await requireAdminPage()
  const { q, page: requestedPage } = readAdminListQuery(await searchParams)
  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { id: q },
        ],
      }
    : {}
  const total = await prisma.user.count({ where })
  const pagination = adminPagination(requestedPage, total)
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      role: true,
      auditsUsed: true,
      auditsLimit: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: pagination.skip,
    take: pagination.take,
  })
  const costs = users.length
    ? await prisma.$queryRaw<Array<{ userId: string; total: number | null; unpriced: number }>>(
        Prisma.sql`SELECT a."userId", SUM(c."estimatedCostUsd") FILTER(WHERE c."pricingBasis"='CONFIGURED_ESTIMATE')::double precision AS total, COUNT(*) FILTER(WHERE c."estimatedCostUsd" IS NULL OR c."pricingBasis"!='CONFIGURED_ESTIMATE' )::integer AS unpriced FROM "audit_run_costs" c JOIN "audits" a ON a.id=c."auditId" WHERE a."userId" IN (${Prisma.join(users.map((u) => u.id))}) GROUP BY a."userId"`,
      )
    : []
  const rows = users.map((user) => {
    const cost = costs.find((c) => c.userId === user.id)
    return {
      ...user,
      totalCostLabel: cost
        ? `${formatUsd(cost.total)}${cost.unpriced ? ' + unpriced runs' : ''}`
        : 'Not recorded',
    }
  })
  return (
    <Container variant="wide" className="space-y-6 py-8">
      <PageHeader
        title="Customers"
        description="Manage access and subscriptions from the customer detail."
      />
      <AdminListSearch path="/admin/users" q={q} label="Search email, name, or user ID" />
      <UserTable users={rows} emptyMessage="No customers match this view." />
      <AdminPagination path="/admin/users" {...pagination} total={total} filters={{ q }} />
    </Container>
  )
}
