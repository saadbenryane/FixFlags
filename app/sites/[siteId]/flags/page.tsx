import { redirect } from 'next/navigation'
import { requireSitePageAccess } from '@/lib/sites/page-access'

export default async function SiteFlagsPage({
  params, searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams?: Promise<{ tab?: string }>
}) {
  const { siteId } = await params
  const access = await requireSitePageAccess(siteId, `/sites/${encodeURIComponent(siteId)}/flags`)
  const resolvedId = access.decision.site.siteId
  if ((await searchParams)?.tab === 'resolved') redirect(`/sites/${resolvedId}?view=timeline#timeline`)
  redirect(`/sites/${resolvedId}#website-checks`)
}
