import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'

export default async function ExpertReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  const { id } = await params
  const order = await prisma.expertReviewOrder.findFirst({
    where: { id, userId: session!.user.id, status: { in: ['DELIVERED', 'FULFILLED'] } },
    include: {
      audit: { select: { id: true, url: true } },
      deliverable: true,
    },
  })
  if (!order?.deliverable?.deliveredAt) notFound()

  const priorities = Array.isArray(order.deliverable.priorities)
    ? (order.deliverable.priorities as Array<{
        title: string
        rationale: string
        action: string
      }>)
    : []

  return (
    <Container variant="content" className="space-y-10 py-10">
      <header className="space-y-3">
        <p className="section-label">Expert Review</p>
        <h1 className="font-display text-4xl tracking-display">What to fix next</h1>
        {order.audit && (
          <Link href={`/report/${order.audit.id}`} className="text-sm text-brand hover:underline">
            {order.audit.url}
          </Link>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-heading">Executive summary</h2>
        <div className="max-w-prose whitespace-pre-wrap text-base leading-relaxed">
          {order.deliverable.summary}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="font-display text-2xl tracking-heading">Prioritized actions</h2>
        <ol className="space-y-8">
          {priorities.map((priority, index) => (
            <li key={`${priority.title}-${index}`} className="grid gap-3 sm:grid-cols-[3rem_1fr]">
              <span className="font-mono text-sm tabular-nums text-brand">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{priority.title}</h3>
                <p className="text-sm text-muted-foreground">{priority.rationale}</p>
                <p className="whitespace-pre-wrap text-sm">{priority.action}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {order.deliverable.reportUrl && (
        <Button asChild>
          <a href={order.deliverable.reportUrl} target="_blank" rel="noreferrer">
            Open supporting report
          </a>
        </Button>
      )}
    </Container>
  )
}
