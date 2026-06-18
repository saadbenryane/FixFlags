import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TextLink } from '@/components/ui/text-link'
import { Container } from '@/components/ui/container'
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
    <Container variant="report" className="py-8 space-y-8">
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
              <Card key={order.id} className="border-0 shadow-card">
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
                      <TextLink href={`/report/${order.audit.id}`}>
                        {order.audit.url}
                      </TextLink>
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
        {fulfilled.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fulfilled orders yet.</p>
        ) : (
          fulfilled.slice(0, 10).map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between rounded-card px-4 py-3 text-sm glass-surface shadow-card"
            >
              <span>{order.email}</span>
              <span className="text-muted-foreground">
                {new Date(order.updatedAt).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </section>

      <Button variant="outline" asChild>
        <Link href="/admin">Back to admin</Link>
      </Button>
    </Container>
  )
}
