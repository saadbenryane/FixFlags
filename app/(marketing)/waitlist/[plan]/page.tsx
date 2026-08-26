import { redirect } from 'next/navigation'
import type { Metadata, Route } from 'next'
import { WaitlistLanding } from '@/components/marketing/waitlist/WaitlistLanding'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import type { CheckoutPlan } from '@/lib/billing/client-checkout'

const PLAN_BY_SEGMENT: Record<string, CheckoutPlan> = {
  pro: 'BUILDER',
  studio: 'TEAM',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ plan: string }>
}): Promise<Metadata> {
  const { plan } = await params
  const checkoutPlan = PLAN_BY_SEGMENT[plan.toLowerCase()]
  if (!checkoutPlan) return buildPageMetadata('waitlist', '/waitlist')

  return {
    ...buildPageMetadata('waitlist', '/waitlist'),
    robots: { index: false, follow: true },
  }
}

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
