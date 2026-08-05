import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { WaitlistLanding } from '@/components/marketing/waitlist/WaitlistLanding'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import type { CheckoutPlan } from '@/lib/billing/client-checkout'

export const metadata = buildPageMetadata('waitlist', '/waitlist')

const PLAN_BY_SEGMENT: Record<string, CheckoutPlan> = {
  pro: 'BUILDER',
  studio: 'TEAM',
}

export default async function WaitlistPlanPage({
  params,
}: {
  params: Promise<{ plan: string }>
}) {
  const { plan } = await params
  const checkoutPlan = PLAN_BY_SEGMENT[plan.toLowerCase()]
  if (!checkoutPlan) redirect('/waitlist' as Route)
  return <WaitlistLanding initialPlan={checkoutPlan} />
}
