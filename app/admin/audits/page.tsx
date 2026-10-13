import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { prisma } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { formatUsd } from '@/lib/billing/costs'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { TextLink } from '@/components/ui/text-link'
import {
  AdminTable,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from '@/components/admin/AdminTable'
import { RetryAuditButton } from '@/components/admin/RetryAuditButton'
import { AuditStatus, type Prisma } from '@prisma/client'
import { AdminListSearch, AdminPagination } from '@/components/admin/AdminListControls'
import { readAdminListQuery, adminPagination } from '@/lib/admin/list-query'

export default async function AdminAuditsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>
}) {
  await requireAdminPage()
  const params = await searchParams
  const { q, page: requestedPage } = readAdminListQuery(params)
  const status = Object.values(AuditStatus).find((value) => value === params.status)
  const where: Prisma.AuditWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { url: { contains: q, mode: 'insensitive' as const } },
            { user: { email: { contains: q, mode: 'insensitive' as const } } },
            { id: q },
          ],
        }
      : {}),
  }
  const total = await prisma.audit.count({ where })
  const pagination = adminPagination(requestedPage, total)
  const audits = await prisma.audit.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: pagination.skip,
    take: pagination.take,
    select: {
      id: true,
      url: true,
      status: true,
      createdAt: true,
      pipelineVersion: true,
      user: { select: { email: true } },
      runCost: {
        select: {
          estimatedCostUsd: true,
          llmInputTokens: true,
          llmOutputTokens: true,
          durationMs: true,
        },
      },
    },
  })

  return (
    <Container variant="wide" className="space-y-8 py-8">
      <PageHeader
        title="Recent checks"
        description="Pipeline runs with token usage and estimated LLM cost."
      />
      <AdminListSearch
        path="/admin/audits"
        q={q}
        label="Search URL, email, or check ID"
        filters={{ status }}
        statusOptions={Object.values(AuditStatus)}
      />
      <AdminTable
        isEmpty={audits.length === 0}
        emptyMessage={q || status ? 'No checks match these filters.' : 'No checks yet.'}
      >
        <AdminTableHead>
          <AdminTableHeaderCell>URL</AdminTableHeaderCell>
          <AdminTableHeaderCell>User</AdminTableHeaderCell>
          <AdminTableHeaderCell>Status</AdminTableHeaderCell>
          <AdminTableHeaderCell>LLM tokens</AdminTableHeaderCell>
          <AdminTableHeaderCell>Est. cost</AdminTableHeaderCell>
          <AdminTableHeaderCell>Created</AdminTableHeaderCell>
          <AdminTableHeaderCell></AdminTableHeaderCell>
        </AdminTableHead>
        <tbody>
          {audits.map((audit, i) => (
            <AdminTableRow key={audit.id} index={i}>
              <AdminTableCell>
                <TextLink
                  href={`/admin/audits/${audit.id}`}
                  className="truncate block max-w-[240px]"
                >
                  {audit.url}
                </TextLink>
              </AdminTableCell>
              <AdminTableCell className="text-muted-foreground">
                {audit.user?.email ?? 'Anonymous'}
              </AdminTableCell>
              <AdminTableCell>
                <Badge variant="outline" className="text-xs">
                  {audit.status}
                </Badge>
              </AdminTableCell>
              <AdminTableCell className="text-muted-foreground tabular-nums">
                {audit.runCost ? audit.runCost.llmInputTokens + audit.runCost.llmOutputTokens : '–'}
              </AdminTableCell>
              <AdminTableCell className="text-muted-foreground">
                {audit.runCost ? formatUsd(audit.runCost.estimatedCostUsd) : '–'}
              </AdminTableCell>
              <AdminTableCell className="text-muted-foreground text-xs">
                {new Date(audit.createdAt).toLocaleString()}
              </AdminTableCell>
              <AdminTableCell>
                {audit.status === 'FAILED' && <RetryAuditButton auditId={audit.id} />}
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </tbody>
      </AdminTable>
      <AdminPagination path="/admin/audits" {...pagination} total={total} filters={{ q, status }} />
    </Container>
  )
}
