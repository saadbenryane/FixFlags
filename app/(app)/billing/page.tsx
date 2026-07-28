import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { Button } from '@/components/ui/button'
import { UsageMeter } from '@/components/dashboard/UsageMeter'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { getPurchasedCreditsRemaining } from '@/lib/billing/credits'
import {
  getEffectiveScanLimit,
  getPendingCheckCount,
  isDevUnlimitedScans,
  isUnlimitedScanLimit,
} from '@/lib/auth/permissions'
import { ManageSubscriptionButton } from '@/components/billing/ManageSubscriptionButton'
import { Heading, Muted, SectionTitle } from '@/components/ui/typography'
import { Callout } from '@/components/ui/callout'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatUsd } from '@/lib/billing/costs'
import { helpHrefForSurface } from '@/lib/help/contextual'
import { Suspense } from 'react'
import { BillingCreditsToast } from '@/components/billing/BillingCreditsToast'

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
  // A lapsed subscription (payment failure, cancellation) only updates subscriptionStatus via
  // the Stripe webhook - plan can lag behind until a separate subscription.updated event
  // resyncs it. Billing must show the true current state, not the stale plan field.
  const isPaid = user.plan !== 'FREE' && !hasRevokedSubscriptionStatus(user.subscriptionStatus)
  const isActivating = isPaid && !user.stripeCustomerId

  const displayPlanName =
    user.subscriptionStatus === 'PAST_DUE' && user.plan !== 'FREE'
      ? `${planDef.name} (payment past due: features paused)`
      : `${planDef.name} plan`

  return (
    <Container variant="narrow" className="space-y-8 py-8">
      <Suspense
        fallback={
          <span className="sr-only" role="status">
            Checking credit purchase status
          </span>
        }
      >
        <BillingCreditsToast />
      </Suspense>
      <PageHeader title="Billing" description="Manage your plan and subscription" />

      {user.subscriptionStatus === 'PAST_DUE' && (
        <Callout variant="warning" title="Payment past due: features paused">
          <p>
            Update your card to restore paid features (compare, MCP, share). We&rsquo;ll retry
            automatically, but you can fix it now. Re-checks on owned reports stay free.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {user.stripeCustomerId && <ManageSubscriptionButton />}
            <Button asChild variant="outline" size="sm">
              <Link href={helpHrefForSurface('billing_past_due')}>View help article</Link>
            </Button>
          </div>
        </Callout>
      )}

      <Card variant="subtle" className="space-y-4 p-6">
        <div className="space-y-1">
          <Heading as="h2" className="text-base">
            {displayPlanName}
          </Heading>
          <Muted>
            {isPaid ? (
              <>
                {planDef.price}
                {planDef.period} · {planDef.auditLimitLabel}
              </>
            ) : (
              <>
                {PLAN_DEFINITIONS.FREE.price || '$0'} · {PLAN_DEFINITIONS.FREE.auditLimitLabel}
                {user.plan !== 'FREE' ? ' (paid features paused)' : ''}
              </>
            )}
          </Muted>
          {user.subscriptionStatus !== 'NONE' && (
            <p className="text-xs text-muted-foreground">
              Subscription status: {user.subscriptionStatus.toLowerCase().replaceAll('_', ' ')}
            </p>
          )}
        </div>

        {(user.subscriptionStatus === 'CANCELED' || user.subscriptionStatus === 'UNPAID') && (
          <Callout variant="danger" title="Payment issue">
            {user.subscriptionStatus === 'CANCELED'
              ? 'Your subscription has been canceled. Features may be downgraded.'
              : 'Your subscription is unpaid. Please check your payment method.'}
          </Callout>
        )}
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
          <div className="flex flex-wrap gap-2">
            <ManageSubscriptionButton />
            {user.plan === 'BUILDER' && (
              <Button asChild variant="outline" size="sm">
                <Link href="/pricing">Compare Agency</Link>
              </Button>
            )}
          </div>
        ) : user.stripeCustomerId ? (
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
        <Card variant="subtle" className="space-y-4 p-6" id="credit-packs">
          <SectionTitle>Credits</SectionTitle>
          {purchasedCreditsRemaining > 0 && (
            <p className="text-sm text-muted-foreground">
              {purchasedCreditsRemaining} purchased audit{purchasedCreditsRemaining !== 1 ? 's' : ''} available
            </p>
          )}
          {purchasedCreditsRemaining === 0 && (
            <p className="text-xs text-muted-foreground">
              Credit packs are no longer available for purchase. Existing credits remain active and never expire.
            </p>
          )}

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
    </Container>
  )
}
