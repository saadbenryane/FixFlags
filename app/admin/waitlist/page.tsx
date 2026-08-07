import Link from 'next/link'
import type { Route } from 'next'
import { prisma } from '@/lib/db'
import {
  listWaitlistRows,
  waitlistBatchCounts,
  waitlistGrantCounts,
  waitlistTierCounts,
} from '@/lib/billing/waitlist-segments'
import { openBatch } from '@/lib/billing/paid-open'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { WaitlistTable } from '@/components/admin/WaitlistTable'

export default async function AdminWaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const params = await searchParams
  const planFilter =
    params.plan === 'BUILDER' || params.plan === 'TEAM' ? params.plan : undefined

  const rows = await listWaitlistRows(planFilter)
  const proCount = await prisma.paidPlanWaitlistEntry.count({ where: { plan: 'BUILDER' } })
  const studioCount = await prisma.paidPlanWaitlistEntry.count({ where: { plan: 'TEAM' } })
  const proTiers = await waitlistTierCounts('BUILDER')
  const studioTiers = await waitlistTierCounts('TEAM')
  const proBatches = await waitlistBatchCounts('BUILDER')
  const studioBatches = await waitlistBatchCounts('TEAM')
  const proGrants = await waitlistGrantCounts('BUILDER')
  const studioGrants = await waitlistGrantCounts('TEAM')
  const releasedBatch = openBatch()

  function tierBadge(tiers: { tier1: number; tier2: number; noTier: number }) {
    return (
      <span className="text-3xs text-muted-foreground">
        <span className="font-medium text-foreground">T1 {tiers.tier1}</span> ·{' '}
        <span className="font-medium text-foreground">T2 {tiers.tier2}</span> · None{' '}
        {tiers.noTier}
      </span>
    )
  }

  function batchBadge(batches: { batch1: number; batch2: number; noBatch: number }) {
    return (
      <span className="text-3xs text-muted-foreground">
        <span className="font-medium text-foreground">B1 {batches.batch1}</span> ·{' '}
        <span className="font-medium text-foreground">B2 {batches.batch2}</span> · None{' '}
        {batches.noBatch}
      </span>
    )
  }

  function releaseBadge(grants: { granted: number; grantedBatch1: number; grantedBatch2: number; converted: number }) {
    return (
      <span className="text-3xs text-muted-foreground">
        Granted <span className="font-medium text-foreground">{grants.granted}</span>
        {' ('}B1 <span className="font-medium text-foreground">{grants.grantedBatch1}</span> · B2{' '}
        <span className="font-medium text-foreground">{grants.grantedBatch2}</span>
        {')'} · Converted <span className="font-medium text-foreground">{grants.converted}</span>
      </span>
    )
  }

  return (
    <Container variant="wide" className="space-y-6 py-8">
      <PageHeader
        title="Paid plan waitlist"
        description="Pro and Studio waitlist with usage signals. T1 = first 500 (25% off), T2 = next 500 (15% off), None = list price. B1/B2 = access batches; checkout requires a released batch (WAITLIST_OPEN_BATCH) or an explicit grant."
      />

      <div
        className="flex flex-wrap items-center gap-2 rounded-card border border-border/60 bg-background/80 px-4 py-3 text-sm"
        role="status"
      >
        <span className="font-medium text-foreground">Release state</span>
        {releasedBatch >= 1 ? (
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            Batch {releasedBatch} open (WAITLIST_OPEN_BATCH={releasedBatch})
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            No batch open (checkout still waitlist-gated)
          </span>
        )}
        {releasedBatch >= 2 && (
          <span className="text-xs text-muted-foreground">
            General release: every waitlist member may check out.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant={planFilter === undefined ? 'default' : 'outline'} size="sm" asChild>
          <Link href={'/admin/waitlist' as Route}>All ({proCount + studioCount})</Link>
        </Button>
        <Button variant={planFilter === 'BUILDER' ? 'default' : 'outline'} size="sm" asChild>
          <Link href={'/admin/waitlist?plan=BUILDER' as Route}>
            Pro ({proCount}) {planFilter === 'BUILDER' && batchBadge(proBatches)}
          </Link>
        </Button>
        <Button variant={planFilter === 'TEAM' ? 'default' : 'outline'} size="sm" asChild>
          <Link href={'/admin/waitlist?plan=TEAM' as Route}>
            Studio ({studioCount}) {planFilter === 'TEAM' && batchBadge(studioBatches)}
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/admin/waitlist/export${planFilter ? `?plan=${planFilter}` : ''}`}>
            Export CSV
          </a>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-border/60 bg-muted/40 p-4 text-sm">
          <p className="font-medium text-foreground">Pro batches</p>
          <p className="mt-1 text-xs text-muted-foreground">{batchBadge(proBatches)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tierBadge(proTiers)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{releaseBadge(proGrants)}</p>
        </div>
        <div className="rounded-card border border-border/60 bg-muted/40 p-4 text-sm">
          <p className="font-medium text-foreground">Studio batches</p>
          <p className="mt-1 text-xs text-muted-foreground">{batchBadge(studioBatches)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tierBadge(studioTiers)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{releaseBadge(studioGrants)}</p>
        </div>
      </div>

      <WaitlistTable rows={rows} />
    </Container>
  )
}
