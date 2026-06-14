import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ExpertReviewEditor } from '@/components/admin/ExpertReviewEditor'
import { Button } from '@/components/ui/button'

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
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{order.email}</p>
        <h1 className="text-2xl font-bold">Author Expert Review</h1>
        {order.audit && (
          <Link href={`/audit/${order.audit.id}`} className="text-sm text-brand hover:underline">
            {order.audit.url}
          </Link>
        )}
      </div>
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
