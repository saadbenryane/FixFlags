import { requireAdminPage } from '@/lib/auth/require-admin-page'
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
import { AdminListSearch, AdminPagination } from '@/components/admin/AdminListControls'
import { readAdminListQuery, adminPagination } from '@/lib/admin/list-query'
import {
  AdminTable,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from '@/components/admin/AdminTable'
import { deriveLeadPotential, formatLeadPotential, type LeadPotential } from '@/lib/leads/qualify'

const POTENTIAL_FILTERS: Array<{ label: string; value?: LeadPotential }> = [
  { label: 'All' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
]

const STATUS_FILTERS: Array<{ label: string; value?: LeadStatus }> = [
  { label: 'New', value: 'NEW' },
  { label: 'Contacted', value: 'CONTACTED' },
  { label: 'Converted', value: 'CONVERTED' },
  { label: 'Disqualified', value: 'DISQUALIFIED' },
]

function potentialWhere(potential: LeadPotential): Prisma.LeadWhereInput {
  switch (potential) {
    case 'high':
      return { linkedUserId: { not: null }, scanCount: { gte: 1 } }
    case 'medium':
      return { linkedUserId: null, scanCount: { gte: 2 } }
    case 'low':
      return {
        OR: [
          { linkedUserId: null, scanCount: { lte: 1 } },
          { linkedUserId: { not: null }, scanCount: { lte: 0 } },
        ],
      }
  }
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    potential?: string
    sort?: string
    q?: string
    page?: string
  }>
}) {
  await requireAdminPage()
  const params = await searchParams
  const { q, page: requestedPage } = readAdminListQuery(params)
  const potentialFilter = POTENTIAL_FILTERS.find((f) => f.value === params.potential)?.value
  const statusFilter = STATUS_FILTERS.find((f) => f.value === params.status)?.value
  const sort = params.sort === 'scans' || params.sort === 'cost' ? params.sort : 'lastSeen'

  const orderBy: Prisma.LeadOrderByWithRelationInput =
    sort === 'scans'
      ? { scanCount: 'desc' }
      : sort === 'cost'
        ? { totalCostUsd: 'desc' }
        : { lastSeenAt: 'desc' }

  const where: Prisma.LeadWhereInput = {
    ...(potentialFilter ? potentialWhere(potentialFilter) : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { normalizedDomain: { contains: q, mode: 'insensitive' as const } },
                { linkedUser: { email: { contains: q, mode: 'insensitive' as const } } },
              ],
            },
          ],
        }
      : {}),
  }

  const total = await prisma.lead.count({ where })
  const pagination = adminPagination(requestedPage, total)

  const leads = await prisma.lead.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: [orderBy, { id: 'desc' }],
    skip: pagination.skip,
    take: pagination.take,
    include: {
      linkedUser: { select: { email: true } },
    },
  })

  function buildHref(overrides: {
    potential?: string | null
    status?: string | null
    sort?: string
  }) {
    const query = new URLSearchParams()
    if (q) query.set('q', q)
    const nextPotential =
      overrides.potential === null ? undefined : (overrides.potential ?? potentialFilter)
    const nextStatus = overrides.status === null ? undefined : (overrides.status ?? statusFilter)
    const nextSort = overrides.sort ?? sort
    if (nextPotential) query.set('potential', nextPotential)
    if (nextStatus) query.set('status', nextStatus)
    if (nextSort && nextSort !== 'lastSeen') query.set('sort', nextSort)
    const qs = query.toString()
    return qs ? `/admin/leads?${qs}` : '/admin/leads'
  }

  return (
    <Container variant="wide" className="space-y-8 py-8">
      <PageHeader title="Leads" description="Domains scanned on FixFlags, grouped for outbound." />
      <AdminListSearch
        path="/admin/leads"
        q={q}
        label="Search domain or account email"
        filters={{ potential: potentialFilter, status: statusFilter, sort }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">Potential</span>
        {POTENTIAL_FILTERS.map((item) => {
          const href = buildHref({
            potential: item.value ?? null,
          }) as Route
          const active = (potentialFilter ?? undefined) === item.value
          return (
            <Button key={item.label} variant={active ? 'default' : 'outline'} size="sm" asChild>
              <Link href={href}>{item.label}</Link>
            </Button>
          )
        })}
        <span className="mx-2 text-muted-foreground">|</span>
        <span className="text-xs font-medium text-muted-foreground mr-1">Status</span>
        {STATUS_FILTERS.map((item) => {
          const href = buildHref({
            status: statusFilter === item.value ? null : (item.value ?? null),
          }) as Route
          const active = statusFilter === item.value
          return (
            <Button key={item.label} variant={active ? 'default' : 'outline'} size="sm" asChild>
              <Link href={href}>{item.label}</Link>
            </Button>
          )
        })}
        <span className="mx-2 text-muted-foreground">|</span>
        {[
          { label: 'Last seen', value: 'lastSeen' },
          { label: 'Scans', value: 'scans' },
          { label: 'Cost', value: 'cost' },
        ].map((item) => {
          const href = buildHref({ sort: item.value }) as Route
          const active = sort === item.value
          return (
            <Button key={item.value} variant={active ? 'default' : 'ghost'} size="sm" asChild>
              <Link href={href}>{item.label}</Link>
            </Button>
          )
        })}
      </div>

      <AdminTable
        isEmpty={leads.length === 0}
        emptyMessage={
          q || potentialFilter || statusFilter
            ? 'No leads match these filters.'
            : 'No leads yet. They appear when checks complete.'
        }
      >
        <AdminTableHead>
          <AdminTableHeaderCell>Domain</AdminTableHeaderCell>
          <AdminTableHeaderCell>Checks</AdminTableHeaderCell>
          <AdminTableHeaderCell>Total cost</AdminTableHeaderCell>
          <AdminTableHeaderCell>Avg / check</AdminTableHeaderCell>
          <AdminTableHeaderCell>Score</AdminTableHeaderCell>
          <AdminTableHeaderCell>Potential</AdminTableHeaderCell>
          <AdminTableHeaderCell>Status</AdminTableHeaderCell>
          <AdminTableHeaderCell>User</AdminTableHeaderCell>
          <AdminTableHeaderCell>Last seen</AdminTableHeaderCell>
        </AdminTableHead>
        <tbody>
          {leads.map((lead, i) => {
            const potential = deriveLeadPotential({
              linkedUserId: lead.linkedUserId,
              scanCount: lead.scanCount,
            })
            return (
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
                  <Badge variant={potential === 'high' ? 'default' : 'outline'} className="text-xs">
                    {formatLeadPotential(potential)}
                  </Badge>
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
            )
          })}
        </tbody>
      </AdminTable>
      <AdminPagination
        path="/admin/leads"
        {...pagination}
        total={total}
        filters={{ q, potential: potentialFilter, status: statusFilter, sort }}
      />
    </Container>
  )
}
