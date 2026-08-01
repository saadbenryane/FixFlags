import Link from 'next/link'
import { prisma } from '@/lib/db'
import { listWaitlistRows } from '@/lib/billing/waitlist-segments'
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

  return (
    <Container variant="wide" className="space-y-6 py-8">
      <PageHeader
        title="Paid plan waitlist"
        description="Pro and Studio waitlist with usage signals for batch invites."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant={planFilter === undefined ? 'default' : 'outline'} size="sm" asChild>
          <Link href="/admin/waitlist">All ({proCount + studioCount})</Link>
        </Button>
        <Button variant={planFilter === 'BUILDER' ? 'default' : 'outline'} size="sm" asChild>
          <Link href="/admin/waitlist?plan=BUILDER">Pro ({proCount})</Link>
        </Button>
        <Button variant={planFilter === 'TEAM' ? 'default' : 'outline'} size="sm" asChild>
          <Link href="/admin/waitlist?plan=TEAM">Studio ({studioCount})</Link>
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
