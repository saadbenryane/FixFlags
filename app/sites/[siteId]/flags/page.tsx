import { notFound } from 'next/navigation'
import { SiteFlagsView, siteFlagTab } from '@/components/sites/SiteFlagsView'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'

export default async function SiteFlagsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const { siteId } = await params
  const { tab } = await searchParams
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()
  const resolvedId = access.decision.site.siteId
  const home = await loadSiteHome(resolvedId)
  if (!home) notFound()
  return <SiteFlagsView siteId={resolvedId} view={home} tab={siteFlagTab(tab)} />
}
