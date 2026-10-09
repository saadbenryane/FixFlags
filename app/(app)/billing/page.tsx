import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { ManageSubscriptionButton } from '@/components/billing/ManageSubscriptionButton'
import { BillingPlanActions } from '@/components/billing/BillingPlanActions'
import { BillingPlansSection } from '@/components/billing/BillingPlansSection'
import { Heading, Muted, SectionTitle } from '@/components/ui/typography'
import { Callout } from '@/components/ui/callout'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { BILLING_PAGE_COPY, HELP_CENTER } from '@/lib/marketing/copy'
import { billingAccountState } from '@/lib/billing/account-state'
import { isPaidOpenServer } from '@/lib/billing/paid-open'
import { helpHrefForSlug, helpHrefForSurface } from '@/lib/help/contextual'
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

  const planDef = PLAN_DEFINITIONS[user.plan]
  const [siteCount, waitlist] = await Promise.all([
    prisma.project.count({ where: { userId: user.id, deletedAt: null } }),
    prisma.paidPlanWaitlistEntry.findFirst({
      where: { userId: user.id, convertedAt: null },
      select: { id: true },
    }),
  ])
  const accountState = billingAccountState({
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    paidCheckoutOpen: isPaidOpenServer(),
    waitlisted: Boolean(waitlist),
  })
  // A lapsed subscription (payment failure, cancellation) only updates subscriptionStatus via
  // the Stripe webhook - plan can lag behind until a separate subscription.updated event
  // resyncs it. Billing must show the true current state, not the stale plan field.
  const isPaid = accountState === 'active'
  const hasStripeCustomer = Boolean(user.stripeCustomerId)
  const copy = BILLING_PAGE_COPY

  const displayPlanName =
    user.subscriptionStatus === 'PAST_DUE' && user.plan !== 'FREE'
      ? copy.pastDuePlanName(planDef.name)
      : copy.planName(planDef.name)

  return (
    <Container variant="narrow" className="space-y-8 py-8">
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
        <dl className="grid gap-3 border-t border-border/60 pt-5 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">Websites</dt><dd className="mt-1 font-medium">{siteCount}{planDef.projectLimit ? ` of ${planDef.projectLimit}` : ''}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Cadence</dt><dd className="mt-1 font-medium">{isPaid ? 'Daily monitoring' : 'Weekly monitoring'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Billing status</dt><dd className="mt-1 font-medium">{copy.state[accountState]}</dd></div>
        </dl>
        {user.stripeCurrentPeriodEnd && isPaid && (
          <p className="text-xs text-muted-foreground">
            {copy.periodEnds(new Date(user.stripeCurrentPeriodEnd).toLocaleDateString())}
          </p>
        )}
        <BillingPlanActions
          isPaid={isPaid}
          hasStripeCustomer={hasStripeCustomer}
        />
      </Card>

      <BillingPlansSection currentPlan={user.plan} />

      <Card variant="subtle" className="space-y-4 p-6" id="billing-history">
        <div className="space-y-1">
          <SectionTitle>{copy.historyTitle}</SectionTitle>
          <Muted className="text-sm">{copy.historyDescription}</Muted>
        </div>

        {hasStripeCustomer ? (
          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">{copy.historyInvoicesHint}</p>
            <div className="flex flex-wrap items-center gap-3">
              <ManageSubscriptionButton label={copy.historyViewInvoices} />
              <TextLink href={helpHrefForSlug('manage-an-existing-subscription')}>
                {copy.historyHelpCta}
              </TextLink>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            <TextLink href={helpHrefForSlug('manage-an-existing-subscription')}>
              {copy.historyHelpCta}
            </TextLink>
          </p>
        )}
      </Card>
    </Container>
  )
}
