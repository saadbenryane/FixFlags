import { notFound } from 'next/navigation'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { PageReviewPreview } from '@/components/dev/PageReviewPreview'

/** A development-only interaction review, using the normal viewer boundary. */
export default async function PageReviewPage({ searchParams }: {
  searchParams: Promise<{ site?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { site } = await searchParams
  if (!site || typeof site !== 'string') notFound()
  const access = await requireSiteAccess(site)
  if (!access.ok) notFound()
  const siteId = access.decision.site.siteId
  const view = await loadSiteHome(siteId, {
    ownerEvidence: access.decision.role === 'owner',
    viewerAuthenticated: access.decision.authenticated,
    site: access.decision.site,
  })
  if (!view) notFound()
  return <PageReviewPreview siteId={siteId} initial={view} />
}
