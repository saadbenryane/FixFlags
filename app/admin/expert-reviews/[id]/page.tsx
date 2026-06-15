import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ExpertReviewEditor } from '@/components/admin/ExpertReviewEditor'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { TextLink } from '@/components/ui/text-link'

export default async function AdminExpertReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const order = await prisma.expertReviewOrder.findUnique({
    where: { id },
    include: {
      audit: { select: { id: true, url: true } },
      deliverable: true,
      events: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!order) notFound()

  const priorities = Array.isArray(order.deliverable?.priorities)
    ? (order.deliverable.priorities as Array<{
        title: string
        rationale: string
        action: string
      }>)
    : []

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader title="Author Expert Review" description={order.email}>
        {order.audit && (
          <TextLink href={`/audit/${order.audit.id}`} className="text-sm shrink-0 max-w-xs truncate">
            {order.audit.url}
          </TextLink>
        )}
      </PageHeader>
      <ExpertReviewEditor
        orderId={order.id}
        initialSummary={order.deliverable?.summary ?? ''}
        initialPriorities={priorities}
        initialReportUrl={order.deliverable?.reportUrl ?? ''}
        delivered={order.status === 'DELIVERED' || order.status === 'FULFILLED'}
      />
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Status history</h2>
        {order.events.map((event) => (
          <p key={event.id} className="text-sm text-muted-foreground">
            {event.type.replaceAll('_', ' ')} · {event.createdAt.toISOString()}
          </p>
        ))}
      </div>
      <Button variant="outline" asChild>
        <Link href="/admin/expert-reviews">Back to orders</Link>
      </Button>
    </div>
  )
}
