import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { LabelCaps, SectionTitle } from '@/components/ui/typography'
import { TextLink } from '@/components/ui/text-link'

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
      <div className="space-y-2">
        <LabelCaps>Expert Review</LabelCaps>
        <PageHeader title="What to fix next" />
        {order.audit && (
          <TextLink href={`/report/${order.audit.id}`} className="text-sm">
            {order.audit.url}
          </TextLink>
        )}
      </div>

      <section className="space-y-3">
        <SectionTitle>Executive summary</SectionTitle>
        <div className="max-w-prose whitespace-pre-wrap text-base leading-relaxed">
          {order.deliverable.summary}
        </div>
      </section>

      <section className="space-y-6">
        <SectionTitle>Prioritized actions</SectionTitle>
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
