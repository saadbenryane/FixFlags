import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { UsageMeter } from '@/components/dashboard/UsageMeter'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import {
  getEffectiveScanLimit,
  getPendingCheckCount,
  isDevUnlimitedScans,
  isUnlimitedScanLimit,
} from '@/lib/auth/permissions'
import { ManageSubscriptionButton } from '@/components/billing/ManageSubscriptionButton'
import { Heading, Muted, SectionTitle } from '@/components/ui/typography'
import { Card } from '@/components/ui/card'
import { Surface } from '@/components/ui/surface'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { TextLink } from '@/components/ui/text-link'

const EXPERT_STATUS_LABELS = {
  PENDING: 'Pending payment',
  PAID: 'Paid, queued for review',
  IN_REVIEW: 'In review, we respond within 48 hours',
  DELIVERED: 'Delivered',
  FULFILLED: 'Delivered',
} as const

export default async function BillingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      id: true,
      plan: true,
      role: true,
      auditsUsed: true,
      auditsLimit: true,
      stripeCustomerId: true,
      stripeCurrentPeriodEnd: true,
      subscriptionStatus: true,
    },
  })

  if (!user) notFound()

  const expertOrders = await prisma.expertReviewOrder.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      audit: { select: { id: true, url: true } },
      deliverable: { select: { deliveredAt: true } },
    },
  })

  const planDef = PLAN_DEFINITIONS[user.plan]
  const isUnlimited =
    isDevUnlimitedScans() || isUnlimitedScanLimit(getEffectiveScanLimit(user))
  const effectiveLimit = isUnlimited ? null : getEffectiveScanLimit(user)
  const pending = await getPendingCheckCount(session!.user.id)
  const isPaid = user.plan !== 'FREE'
  const isActivating = isPaid && !user.stripeCustomerId

  return (
    <Container variant="narrow" className="space-y-8 py-8">
      <PageHeader title="Billing" description="Manage your plan and subscription" />

      <Card className="space-y-4 p-6">
        <div className="space-y-1">
          <Heading as="h2" className="text-base">
            {planDef.name} plan
          </Heading>
          <Muted>
            {planDef.price}
            {planDef.period} · {planDef.auditLimitLabel}
          </Muted>
          <p className="text-xs text-muted-foreground">
            Subscription status: {user.subscriptionStatus.toLowerCase().replace('_', ' ')}
          </p>
        </div>
        <UsageMeter
          used={user.auditsUsed}
          limit={effectiveLimit}
          pending={pending}
          plan={user.plan}
        />
        {isActivating && (
          <p className="text-xs text-muted-foreground">
            Activating subscription… This usually takes a few seconds after checkout.
          </p>
        )}
        {user.stripeCurrentPeriodEnd && isPaid && !isActivating && (
          <p className="text-xs text-muted-foreground">
            Current period ends {new Date(user.stripeCurrentPeriodEnd).toLocaleDateString()}
          </p>
        )}
        {isPaid && user.stripeCustomerId ? (
          <ManageSubscriptionButton />
        ) : isPaid ? (
          <Button disabled variant="outline">
            Activating subscription…
          </Button>
        ) : (
          <Button asChild>
            <Link href="/pricing">Upgrade plan</Link>
          </Button>
        )}
      </Card>

      {expertOrders.length > 0 && (
        <Card className="space-y-4 p-6">
          <SectionTitle>Expert Review orders</SectionTitle>
          <div className="space-y-3">
            {expertOrders.map((order) => (
              <Surface key={order.id} variant="flat" className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {EXPERT_STATUS_LABELS[order.status]}
                    </p>
                    <p className="text-muted-foreground">
                      Ordered {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                    {order.audit && (
                      <TextLink href={`/report/${order.audit.id}`}>
                        {order.audit.url}
                      </TextLink>
                    )}
                    {order.deliverable?.deliveredAt && (
                      <TextLink href={`/billing/reviews/${order.id}`} className="mt-2 block font-medium">
                        Read your Expert Review
                      </TextLink>
                    )}
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        </Card>
      )}
    </Container>
  )
}
