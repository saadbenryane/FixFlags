import { notFound, redirect } from 'next/navigation'
import { requireSiteAccess } from '@/lib/sites/request-access'

export default async function SiteFlagsPage({
  params,
}: {
  params: Promise<{ siteId: string }>
}) {
  const { siteId } = await params
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()
  const resolvedId = access.decision.site.siteId
  redirect(`/sites/${resolvedId}?view=flags#flags`)
}
