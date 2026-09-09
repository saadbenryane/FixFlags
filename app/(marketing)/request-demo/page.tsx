import { RequestDemoForm } from '@/components/marketing/demo/RequestDemoForm'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import type { CheckoutPlan } from '@/lib/billing/client-checkout'

export const metadata = buildPageMetadata('requestDemo', '/request-demo')

const PLAN_BY_QUERY: Record<string, CheckoutPlan> = {
  pro: 'BUILDER',
  studio: 'TEAM',
}

export default async function RequestDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const params = await searchParams
  const initialPlan = PLAN_BY_QUERY[params.plan?.toLowerCase() ?? ''] ?? 'BUILDER'
  return <RequestDemoForm initialPlan={initialPlan} />
}
