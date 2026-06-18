import Link from 'next/link'
import { LeadStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatUsd } from '@/lib/billing/costs'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { TextLink } from '@/components/ui/text-link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

      {leads.length === 0 ? (
        <Card className="border-0 shadow-card">
          <div className="py-8 text-center text-sm text-muted-foreground">
            No leads yet. They appear when audits complete.
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border-0 p-0 shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Domain</th>
                <th className="text-left px-4 py-3 font-medium">Scans</th>
                <th className="text-left px-4 py-3 font-medium">Total cost</th>
                <th className="text-left px-4 py-3 font-medium">Avg / scan</th>
                <th className="text-left px-4 py-3 font-medium">Score</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-left px-4 py-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, i) => (
                <tr key={lead.id} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                  <td className="px-4 py-3">
                    <TextLink href={`/admin/leads/${encodeURIComponent(lead.normalizedDomain)}`}>
                      {lead.normalizedDomain}
                    </TextLink>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{lead.scanCount}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatUsd(lead.totalCostUsd)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {lead.scanCount > 0
                      ? formatUsd(lead.totalCostUsd.toNumber() / lead.scanCount)
                      : '–'}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {lead.latestScore ?? '–'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {lead.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {lead.linkedUser?.email ?? '–'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(lead.lastSeenAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Container>
  )
}
