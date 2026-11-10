import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { DashboardCheckoutToast } from '@/components/dashboard/DashboardCheckoutToast'
import { WebsitesDashboard } from '@/components/dashboard/WebsitesDashboard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Container } from '@/components/ui/container'
import { getAppViewer } from '@/lib/auth/app-viewer'
import { normalizeAuditNavigationUrl } from '@/lib/audit/url'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'
import { loadSiteCapacity } from '@/lib/billing/product-capacity'

/**
 * The sign-up handoff lands here as `?url=`. The signup gate sends the visitor
 * to /post-login first, so the URL has to survive that redirect to keep the
 * promise of the Scan button. Only the first value is read so a repeated query
 * cannot start two scans.
 */
function handoffUrl(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = normalizeAuditNavigationUrl(trimmed)
  return normalized.ok ? normalized.url : null
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string | string[] }>
}) {
  const viewer = await getAppViewer()
  if (!viewer) redirect('/sign-in')
  const readAt = Date.now()
  const [sites, params, capacity] = await Promise.all([
    loadSiteSummaries(viewer.user.id),
    searchParams,
    loadSiteCapacity(viewer.user.id),
  ])
  const resumedUrl = handoffUrl(params?.url)

  return (
    <Container
      variant="report"
      className="space-y-6 py-5 pb-24 sm:py-7"
    >
      <Suspense fallback={null}>
        <DashboardCheckoutToast />
      </Suspense>

      <PageHeader title="Websites" />
      <WebsitesDashboard initialSites={sites} ownerId={viewer.user.id} readAt={readAt} resumedUrl={resumedUrl} atSiteLimit={capacity.atLimit} />
    </Container>
  )
}
