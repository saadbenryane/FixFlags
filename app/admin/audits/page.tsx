import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatUsd } from '@/lib/billing/costs'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <PageHeader title="Recent audits" />
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">URL</th>
              <th className="text-left px-4 py-3 font-medium">User</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">LLM tokens</th>
              <th className="text-left px-4 py-3 font-medium">Est. cost</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((audit, i) => (
              <tr key={audit.id} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                <td className="px-4 py-3">
                  <Link href={`/admin/audits/${audit.id}`} className="text-primary hover:underline truncate block max-w-[240px]">
                    {audit.url}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {audit.user?.email ?? 'Anonymous'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs">{audit.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {audit.runCost
                    ? audit.runCost.llmInputTokens + audit.runCost.llmOutputTokens
                    : '–'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {audit.runCost ? formatUsd(audit.runCost.estimatedCostUsd) : '–'}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(audit.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {audits.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No audits yet.</CardContent>
        </Card>
      )}
    </div>
  )
}
