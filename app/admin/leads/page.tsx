import type { Route } from 'next'
import Link from 'next/link'
import { LeadStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { formatUsd } from '@/lib/billing/costs'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { TextLink } from '@/components/ui/text-link'
import { Button } from '@/components/ui/button'
import {
  AdminTable,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from '@/components/admin/AdminTable'

const STATUS_FILTERS: Array<{ label: string; value?: LeadStatus }> = [
  { label: 'All' },
  { label: 'New', value: 'NEW' },
  { label: 'Qualified', value: 'QUALIFIED' },
  { label: 'Contacted', value: 'CONTACTED' },
]

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string }>
}) {
  const params = await searchParams
  const statusFilter = STATUS_FILTERS.find((f) => f.value === params.status)?.value
  const sort = params.sort ?? 'lastSeen'

  const orderBy: Prisma.LeadOrderByWithRelationInput =
    sort === 'scans'
      ? { scanCount: 'desc' }
      : sort === 'cost'
        ? { totalCostUsd: 'desc' }
        : { lastSeenAt: 'desc' }

  const leads = await prisma.lead.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy,
    take: 200,
    include: {
      linkedUser: { select: { email: true } },
    },
  })

  return (
    <Container variant="wide" className="space-y-8 py-8">
      <PageHeader title="Leads" description="Domains scanned on FixFlags, grouped for outbound." />

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((item) => {
          const href = item.value ? `/admin/leads?status=${item.value}` : '/admin/leads'
          const active = (statusFilter ?? undefined) === item.value
          return (
            <Button key={item.label} variant={active ? 'default' : 'outline'} size="sm" asChild>
              <Link href={href as Route}>{item.label}</Link>
            </Button>
          )
        })}
        <span className="mx-2 text-muted-foreground">|</span>
        {[
          { label: 'Last seen', value: 'lastSeen' },
          { label: 'Scans', value: 'scans' },
          { label: 'Cost', value: 'cost' },
        ].map((item) => {
          const query = new URLSearchParams()
          if (statusFilter) query.set('status', statusFilter)
          query.set('sort', item.value)
          const active = sort === item.value
          return (
            <Button key={item.value} variant={active ? 'default' : 'ghost'} size="sm" asChild>
              <Link href={`/admin/leads?${query.toString()}`}>{item.label}</Link>
            </Button>
          )
        })}
      </div>

      <AdminTable
        isEmpty={leads.length === 0}
        emptyMessage="No leads yet. They appear when checks complete."
      >
        <AdminTableHead>
          <AdminTableHeaderCell>Domain</AdminTableHeaderCell>
          <AdminTableHeaderCell>Checks</AdminTableHeaderCell>
          <AdminTableHeaderCell>Total cost</AdminTableHeaderCell>
          <AdminTableHeaderCell>Avg / check</AdminTableHeaderCell>
          <AdminTableHeaderCell>Score</AdminTableHeaderCell>
          <AdminTableHeaderCell>Status</AdminTableHeaderCell>
          <AdminTableHeaderCell>User</AdminTableHeaderCell>
          <AdminTableHeaderCell>Last seen</AdminTableHeaderCell>
        </AdminTableHead>
            <tbody>
              {leads.map((lead, i) => (
                <AdminTableRow key={lead.id} index={i}>
                  <AdminTableCell>
                    <TextLink href={`/admin/leads/${encodeURIComponent(lead.normalizedDomain)}`}>
                      {lead.normalizedDomain}
                    </TextLink>
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums">{lead.scanCount}</AdminTableCell>
                  <AdminTableCell className="tabular-nums text-muted-foreground">
                    {formatUsd(lead.totalCostUsd)}
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums text-muted-foreground">
                    {lead.scanCount > 0
                      ? formatUsd(lead.totalCostUsd.toNumber() / lead.scanCount)
                      : '–'}
                  </AdminTableCell>
                  <AdminTableCell className="tabular-nums text-muted-foreground">
                    {lead.latestScore ?? '–'}
                  </AdminTableCell>
                  <AdminTableCell>
                    <Badge variant="outline" className="text-xs">
                      {lead.status}
                    </Badge>
                  </AdminTableCell>
                  <AdminTableCell className="text-xs text-muted-foreground">
                    {lead.linkedUser?.email ?? '–'}
                  </AdminTableCell>
                  <AdminTableCell className="text-xs text-muted-foreground">
                    {new Date(lead.lastSeenAt).toLocaleString()}
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </tbody>
      </AdminTable>
    </Container>
  )
}
