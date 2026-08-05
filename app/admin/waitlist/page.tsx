import Link from 'next/link'
import type { Route } from 'next'
import { prisma } from '@/lib/db'
import {
  listWaitlistRows,
  waitlistTierCounts,
} from '@/lib/billing/waitlist-segments'
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

  function tierBadge(tiers: { tier1: number; tier2: number; noTier: number }) {
    return (
      <span className="text-3xs text-muted-foreground">
        <span className="font-medium text-foreground">T1 {tiers.tier1}</span> ·{' '}
        <span className="font-medium text-foreground">T2 {tiers.tier2}</span> · None{' '}
        {tiers.noTier}
      </span>
    )
  }

  return (
    <Container variant="wide" className="space-y-6 py-8">
      <PageHeader
        title="Paid plan waitlist"
        description="Pro and Studio waitlist with usage signals. T1 = first 500 (25% off), T2 = next 500 (15% off), None = list price."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant={planFilter === undefined ? 'default' : 'outline'} size="sm" asChild>
          <Link href={'/admin/waitlist' as Route}>All ({proCount + studioCount})</Link>
        </Button>
        <Button variant={planFilter === 'BUILDER' ? 'default' : 'outline'} size="sm" asChild>
          <Link href={'/admin/waitlist?plan=BUILDER' as Route}>
            Pro ({proCount}) {planFilter === 'BUILDER' && tierBadge(proTiers)}
          </Link>
        </Button>
        <Button variant={planFilter === 'TEAM' ? 'default' : 'outline'} size="sm" asChild>
          <Link href={'/admin/waitlist?plan=TEAM' as Route}>
            Studio ({studioCount}) {planFilter === 'TEAM' && tierBadge(studioTiers)}
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/admin/waitlist/export${planFilter ? `?plan=${planFilter}` : ''}`}>
            Export CSV
          </a>
        </Button>
      </div>

      <WaitlistTable rows={rows} />
    </Container>
  )
}
