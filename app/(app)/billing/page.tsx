import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { UsageMeter } from '@/components/dashboard/UsageMeter'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { CREDIT_PACKS, getPurchasedCreditsRemaining } from '@/lib/billing/credits'
import {
  getEffectiveScanLimit,
  getPendingCheckCount,
  isDevUnlimitedScans,
  isUnlimitedScanLimit,
} from '@/lib/auth/permissions'
import { ManageSubscriptionButton } from '@/components/billing/ManageSubscriptionButton'
import { CreditPackButton } from '@/components/billing/CreditPackButton'
import { Heading, Muted, SectionTitle } from '@/components/ui/typography'
import { Card } from '@/components/ui/card'
import { Surface } from '@/components/ui/surface'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { TextLink } from '@/components/ui/text-link'
import { formatUsd } from '@/lib/billing/costs'

const EXPERT_STATUS_LABELS = {
  PENDING: 'Pending payment',
  PAID: 'Paid, queued for review',
  IN_REVIEW: 'In review, we respond within 48 hours',
  DELIVERED: 'Delivered',
  FULFILLED: 'Delivered',
} as const

export default async function BillingPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) {
    redirect('/sign-in')
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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

  const creditPurchases = await prisma.creditPurchase.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const purchasedCreditsRemaining = await getPurchasedCreditsRemaining(user.id)

  const planDef = PLAN_DEFINITIONS[user.plan]
  const isUnlimited =
    isDevUnlimitedScans() || isUnlimitedScanLimit(getEffectiveScanLimit(user))
  const effectiveLimit = isUnlimited ? null : getEffectiveScanLimit(user)
  const pending = await getPendingCheckCount(session.user.id)
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
          {user.subscriptionStatus !== 'NONE' && (
            <p className="text-xs text-muted-foreground">
              Subscription status: {user.subscriptionStatus.toLowerCase().replace('_', ' ')}
            </p>
          )}
        </div>
        <UsageMeter
          used={user.auditsUsed}
          limit={effectiveLimit}
          pending={pending}
          plan={user.plan}
          purchasedCredits={purchasedCreditsRemaining}
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

      {isPaid && (
        <Card className="space-y-4 p-6" id="credit-packs">
          <SectionTitle>Credit packs</SectionTitle>
          {purchasedCreditsRemaining > 0 && (
            <p className="text-sm text-muted-foreground">
              {purchasedCreditsRemaining} purchased audit{purchasedCreditsRemaining !== 1 ? 's' : ''} available
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Buy extra audits without upgrading your plan. Purchased credits never expire.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CREDIT_PACKS.map((pack) => (
              <Surface key={pack.id} variant={pack.popular ? 'elevated' : 'flat'} className="p-4 space-y-3">
                <div>
                  <p className="font-medium text-sm">{pack.label}</p>
                  <p className="text-lg font-semibold">{formatUsd(pack.priceUsdCents / 100)}</p>
                </div>
                <CreditPackButton
                  packId={pack.id}
                  label={pack.label}
                  price={formatUsd(pack.priceUsdCents / 100)}
                  popular={pack.popular}
                />
              </Surface>
            ))}
          </div>

          {creditPurchases.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Purchase history</p>
              <div className="space-y-1">
                {creditPurchases.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs text-muted-foreground py-1 border-b border-border/20 last:border-0">
                    <span>
                      {p.creditsPurchased} credits - {p.packId.replace('_', ' ')}
                    </span>
                    <span>
                      {formatUsd(p.priceUsdCents / 100)}
                    </span>
                    <span className={p.status === 'PAID' ? 'text-success' : ''}>
                      {p.status === 'PAID' ? 'Paid' : p.status === 'PENDING' ? 'Pending' : p.status.toLowerCase()}
                    </span>
                    {p.paidAt && (
                      <span>{new Date(p.paidAt).toLocaleDateString()}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

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
