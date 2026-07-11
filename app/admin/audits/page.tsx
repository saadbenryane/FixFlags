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

export default async function AdminAuditsPage() {
  const audits = await prisma.audit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
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
        title="Recent audits"
        description="Pipeline runs with token usage and estimated LLM cost."
      />
      <AdminTable isEmpty={audits.length === 0} emptyMessage="No audits yet.">
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
                <TextLink href={`/admin/audits/${audit.id}`} className="truncate block max-w-[240px]">
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
                {audit.runCost
                  ? audit.runCost.llmInputTokens + audit.runCost.llmOutputTokens
                  : '–'}
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
    </Container>
  )
}
