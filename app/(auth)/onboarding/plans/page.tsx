import { Suspense } from 'react'
import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { PlanPickerHost } from '@/components/billing/PlanPickerHost'

export const metadata: Metadata = buildPageMetadata('pricing', '/onboarding/plans')

interface PageProps {
  searchParams: Promise<{ next?: string; from?: string; source?: string }>
}

function resolveSource(source: string | undefined, from: string | undefined): 'post_signup' | 'post_signin' | 'pricing' {
  if (source === 'post_signup' || source === 'post_signin') return source
  if (from === 'pricing') return 'pricing'
  return 'post_signin'
}

export default async function OnboardingPlansPage({ searchParams }: PageProps) {
  const params = await searchParams
  const source = resolveSource(params.source, params.from)
  return (
    <Suspense fallback={null}>
      <PlanPickerHost source={source} next={params.next} from={params.from} />
    </Suspense>
  )
}
