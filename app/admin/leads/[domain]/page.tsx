import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { LeadEditor } from '@/components/admin/LeadEditor'
import { Button } from '@/components/ui/button'
import { SectionTitle } from '@/components/ui/typography'
import { TextLink } from '@/components/ui/text-link'
import { normalizeDomain } from '@/lib/leads/normalize-domain'
import { formatUsd } from '@/lib/billing/costs'

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain: encoded } = await params
  const normalizedDomain = decodeURIComponent(encoded)
  const canonical = normalizeDomain(normalizedDomain)
  if (!canonical || canonical !== normalizedDomain) {
    notFound()
  }

  const lead = await prisma.lead.findUnique({
    where: { normalizedDomain: canonical },
    include: {
      linkedUser: { select: { id: true, email: true, plan: true } },
      supportSessions: {
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { id: true, status: true, lastMessageAt: true, unreadByAgent: true },
      },
    },
  })

  if (!lead) notFound()

  const audits = await prisma.audit.findMany({
    where: {
      OR: [{ normalizedDomain: canonical }, { url: { contains: canonical } }],
      status: 'COMPLETED',
    },
    orderBy: { completedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      url: true,
      score: true,
      completedAt: true,
      user: { select: { email: true } },
      runCost: { select: { estimatedCostUsd: true, durationMs: true } },
    },
  })

  const avgCostPerScan =
    lead.scanCount > 0 ? lead.totalCostUsd.toNumber() / lead.scanCount : 0

  return (
    <Container variant="report" className="space-y-8 py-8">
      <PageHeader
        title={lead.normalizedDomain}
        description={lead.latestUrl ?? undefined}
      >
        <Button variant="outline" asChild>
          <Link href="/admin/leads">All leads</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Lead details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scans</span>
              <span className="font-mono tabular-nums">{lead.scanCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Latest score</span>
              <span className="font-mono tabular-nums">{lead.latestScore ?? '–'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total scan cost</span>
              <span className="font-mono tabular-nums">{formatUsd(lead.totalCostUsd)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg cost / scan</span>
              <span className="font-mono tabular-nums">{formatUsd(avgCostPerScan)}</span>
            </div>
            {lead.latestScanCostUsd != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latest scan cost</span>
                <span className="font-mono tabular-nums">{formatUsd(lead.latestScanCostUsd)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">First seen</span>
              <span>{new Date(lead.firstSeenAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last seen</span>
              <span>{new Date(lead.lastSeenAt).toLocaleString()}</span>
            </div>
            {lead.linkedUser && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account</span>
                <span>{lead.linkedUser.email}</span>
              </div>
            )}
            {lead.source && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span>{lead.source}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadEditor
              domain={lead.normalizedDomain}
              initialStatus={lead.status}
              initialNotes={lead.notes}
            />
          </CardContent>
        </Card>
      </div>

      {lead.supportSessions.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Chat sessions</SectionTitle>
          <Card className="border-0 shadow-card divide-y">
            {lead.supportSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{s.status}</Badge>
                  {s.lastMessageAt && (
                    <span className="text-muted-foreground text-xs">
                      {new Date(s.lastMessageAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <TextLink href={`/admin/inbox?session=${s.id}`}>Open in inbox</TextLink>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle>Audit history</SectionTitle>
        {audits.length === 0 ? (
          <Card className="border-0 shadow-card">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No completed audits found for this domain.
            </CardContent>
          </Card>
        ) : (
        <Card className="overflow-hidden border-0 p-0 shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">URL</th>
                <th className="text-left px-4 py-3 font-medium">Score</th>
                <th className="text-left px-4 py-3 font-medium">Est. cost</th>
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-left px-4 py-3 font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <TextLink href={`/admin/audits/${audit.id}`} className="truncate block max-w-xs">
                      {audit.url}
                    </TextLink>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{audit.score ?? '–'}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {audit.runCost ? formatUsd(audit.runCost.estimatedCostUsd) : '–'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {audit.user?.email ?? 'Anonymous'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {audit.completedAt ? new Date(audit.completedAt).toLocaleString() : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        )}
      </section>
    </Container>
  )
}
