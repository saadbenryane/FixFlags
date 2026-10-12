import { notFound, redirect } from 'next/navigation'
import { requireSiteAccess } from '@/lib/sites/request-access'

export default async function SiteFlagsPage({
  params, searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams?: Promise<{ tab?: string }>
}) {
  const { siteId } = await params
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()
  const resolvedId = access.decision.site.siteId
  if ((await searchParams)?.tab === 'resolved') redirect(`/sites/${resolvedId}?view=timeline#timeline`)
  redirect(`/sites/${resolvedId}#website-checks`)
}
