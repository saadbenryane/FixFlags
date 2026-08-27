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
import { getPendingCheckCount, getPlanDisplayLimit } from '@/lib/auth/permissions'
import { ManageSubscriptionButton } from '@/components/billing/ManageSubscriptionButton'
import { BillingPlanActions } from '@/components/billing/BillingPlanActions'
import { BillingPlansSection } from '@/components/billing/BillingPlansSection'
import { Heading, Muted, SectionTitle } from '@/components/ui/typography'
import { Callout } from '@/components/ui/callout'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatUsd } from '@/lib/billing/costs'
import { BILLING_PAGE_COPY, HELP_CENTER } from '@/lib/marketing/copy'
import { helpHrefForSlug, helpHrefForSurface } from '@/lib/help/contextual'
import { Suspense } from 'react'
import { BillingCreditsToast } from '@/components/billing/BillingCreditsToast'
import { TextLink } from '@/components/ui/text-link'

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
  const displayLimit = getPlanDisplayLimit(user)
  const pending = await getPendingCheckCount(session.user.id)
  // A lapsed subscription (payment failure, cancellation) only updates subscriptionStatus via
  // the Stripe webhook - plan can lag behind until a separate subscription.updated event
  // resyncs it. Billing must show the true current state, not the stale plan field.
  const isPaid = user.plan !== 'FREE' && !hasRevokedSubscriptionStatus(user.subscriptionStatus)
  const isActivating = isPaid && !user.stripeCustomerId
  const hasStripeCustomer = Boolean(user.stripeCustomerId)
  const copy = BILLING_PAGE_COPY

  const displayPlanName =
    user.subscriptionStatus === 'PAST_DUE' && user.plan !== 'FREE'
      ? copy.pastDuePlanName(planDef.name)
      : copy.planName(planDef.name)

  return (
    <Container variant="narrow" className="space-y-8 py-8">
      <Suspense
        fallback={
          <span className="sr-only" role="status">
            {copy.checkingCredits}
          </span>
        }
      >
        <BillingCreditsToast />
      </Suspense>
      <PageHeader title={copy.title} description={copy.description} />

      {user.subscriptionStatus === 'PAST_DUE' && (
        <Callout variant="warning" title={copy.pastDueTitle}>
          <p>{copy.pastDueBody}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {hasStripeCustomer && <ManageSubscriptionButton />}
            <Button asChild variant="outline" size="sm">
              <Link href={helpHrefForSurface('billing_past_due')}>{HELP_CENTER.viewHelpCta}</Link>
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
                {user.plan !== 'FREE' ? copy.paidFeaturesPaused : ''}
              </>
            )}
          </Muted>
        </div>

        {(user.subscriptionStatus === 'CANCELED' || user.subscriptionStatus === 'UNPAID') && (
          <Callout variant="danger" title={copy.paymentIssueTitle}>
            {user.subscriptionStatus === 'CANCELED' ? copy.canceledBody : copy.unpaidBody}
          </Callout>
        )}
        <div className="border-t border-border/60 pt-5">
          <UsageMeter
            used={user.auditsUsed}
            limit={displayLimit}
            pending={pending}
            plan={user.plan}
            purchasedCredits={purchasedCreditsRemaining}
            showUpgradeCta={false}
          />
        </div>
        {isActivating && (
          <p className="text-xs text-muted-foreground">{copy.activatingHint}</p>
        )}
        {user.stripeCurrentPeriodEnd && isPaid && !isActivating && (
          <p className="text-xs text-muted-foreground">
            {copy.periodEnds(new Date(user.stripeCurrentPeriodEnd).toLocaleDateString())}
          </p>
        )}
        <BillingPlanActions
          isPaid={isPaid}
          isActivating={isActivating}
          hasStripeCustomer={hasStripeCustomer}
          showPlanPickerCta={!isActivating}
        />
      </Card>

      <BillingPlansSection currentPlan={user.plan} />

      <Card variant="subtle" className="space-y-4 p-6" id="billing-history">
        <div className="space-y-1">
          <SectionTitle>{copy.historyTitle}</SectionTitle>
          <Muted className="text-sm">{copy.historyDescription}</Muted>
        </div>

        {purchasedCreditsRemaining > 0 && (
          <p className="text-sm text-muted-foreground">
            {copy.purchasedAvailable(purchasedCreditsRemaining)}
          </p>
        )}

        {creditPurchases.length > 0 ? (
          <div className="space-y-1">
            {creditPurchases.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border/20 py-2 text-xs text-muted-foreground last:border-0"
              >
                <span>{copy.creditsLine(p.creditsPurchased, p.packId)}</span>
                <span className="tabular-nums">{formatUsd(p.priceUsdCents / 100)}</span>
                <span className={p.status === 'PAID' ? 'text-success' : ''}>
                  {p.status === 'PAID'
                    ? copy.paid
                    : p.status === 'PENDING'
                      ? copy.pending
                      : p.status.toLowerCase()}
                </span>
                {p.paidAt && (
                  <span className="tabular-nums">{new Date(p.paidAt).toLocaleDateString()}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{copy.historyEmpty}</p>
        )}

        {hasStripeCustomer ? (
          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">{copy.historyInvoicesHint}</p>
            <div className="flex flex-wrap items-center gap-3">
              <ManageSubscriptionButton label={copy.historyViewInvoices} />
              <TextLink href={helpHrefForSlug('invoices-and-receipts')}>
                {copy.historyHelpCta}
              </TextLink>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            <TextLink href={helpHrefForSlug('invoices-and-receipts')}>
              {copy.historyHelpCta}
            </TextLink>
          </p>
        )}
      </Card>
    </Container>
  )
}
