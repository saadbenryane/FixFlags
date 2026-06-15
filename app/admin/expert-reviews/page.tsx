import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function AdminExpertReviewsPage() {
  const orders = await prisma.expertReviewOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      audit: { select: { id: true, url: true } },
      user: { select: { email: true } },
      deliverable: { select: { id: true } },
    },
  })

  const pending = orders.filter((o) => o.status === 'PAID' || o.status === 'IN_REVIEW')
  const fulfilled = orders.filter((o) => o.status === 'DELIVERED' || o.status === 'FULFILLED')

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <PageHeader
        title="Expert Review orders"
        description="Mark orders fulfilled after you deliver the review."
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Awaiting fulfillment ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No paid orders waiting.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((order) => (
              <Card key={order.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{order.email}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Ordered {new Date(order.createdAt).toLocaleString()}
                  </p>
                  {order.audit && (
                    <p>
                      Audit:{' '}
                      <Link href={`/audit/${order.audit.id}`} className="text-brand hover:underline">
                        {order.audit.url}
                      </Link>
                    </p>
                  )}
                  <Button size="sm" asChild>
                    <Link href={`/admin/expert-reviews/${order.id}`}>
                      {order.deliverable ? 'Continue review' : 'Author review'}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Recently fulfilled ({fulfilled.length})</h2>
        {fulfilled.slice(0, 10).map((order) => (
          <div key={order.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 text-sm">
            <span>{order.email}</span>
            <span className="text-muted-foreground">
              {new Date(order.updatedAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </section>

      <Button variant="outline" asChild>
        <Link href="/admin">Back to admin</Link>
      </Button>
    </div>
  )
}
