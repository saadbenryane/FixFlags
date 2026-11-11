import { permanentRedirect, redirect } from 'next/navigation'
import type { Metadata, Route } from 'next'
import { WaitlistLanding } from '@/components/marketing/waitlist/WaitlistLanding'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { RETIRED_WAITLIST_SEGMENTS, isWaitlistPlanSegment, waitlistPathForSegment } from '@/lib/billing/waitlist-path'

type Params = Promise<{ plan: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { plan } = await params
  if (!isWaitlistPlanSegment(plan.toLowerCase())) return buildPageMetadata('waitlist', '/waitlist')

  return {
    ...buildPageMetadata('waitlist', '/waitlist'),
    robots: { index: false, follow: true },
  }
}

export default async function WaitlistPlanPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { plan } = await params
  const segment = plan.toLowerCase()
  const retired = RETIRED_WAITLIST_SEGMENTS[segment]
  if (retired) {
    // Old links, including invite links with ?code=, keep their query string.
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(await searchParams)) {
      for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item)
    }
    const search = query.toString()
    permanentRedirect(`${waitlistPathForSegment(retired)}${search ? `?${search}` : ''}` as Route)
  }
  if (!isWaitlistPlanSegment(segment)) redirect('/waitlist' as Route)
  return <WaitlistLanding segment={segment} />
}
