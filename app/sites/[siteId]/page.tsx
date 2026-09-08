import { notFound } from 'next/navigation'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { SiteBoard } from '@/components/sites/SiteBoard'

export default async function SiteDashboardPage({
  params,
}: {
  params: Promise<{ siteId: string }>
}) {
  const { siteId } = await params
  const home = await loadSiteHome(siteId)
  if (!home) notFound()

  return <SiteBoard siteId={siteId} initial={home} />
}
