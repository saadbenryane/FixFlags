import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatUsd } from '@/lib/billing/costs'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { TextLink } from '@/components/ui/text-link'
import { cn } from '@/lib/utils'

export default async function AdminLeadsPage() {
  const leads = await prisma.lead.findMany({
    orderBy: { lastSeenAt: 'desc' },
    take: 200,
    include: {
      linkedUser: { select: { email: true } },
    },
  })

  return (
    <Container variant="wide" className="space-y-6 py-8">
      <PageHeader title="Leads" description="Domains scanned on FixFlags, grouped for outbound." />
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
      {leads.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No leads yet. They appear when audits complete.
          </CardContent>
        </Card>
      )}
    </Container>
  )
}
