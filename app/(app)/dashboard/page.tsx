import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { DashboardCheckoutToast } from '@/components/dashboard/DashboardCheckoutToast'
import { SitesOverviewGrid } from '@/components/sites/SitesOverviewGrid'
import { PageHeader } from '@/components/layout/PageHeader'
import { Container } from '@/components/ui/container'
import { AuditInput } from '@/components/audit/AuditInput'
import { getAppViewer } from '@/lib/auth/app-viewer'
import { normalizeAuditNavigationUrl } from '@/lib/audit/url'
import { loadSiteSummaries } from '@/lib/sites/application/list-sites'
import { SCAN_HANDOFF, WEBSITES_COPY } from '@/lib/marketing/copy-barrel'
import styles from './Dashboard.module.css'

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
  const [sites, params] = await Promise.all([
    loadSiteSummaries(viewer.user.id),
    searchParams,
  ])
  const resumedUrl = handoffUrl(params?.url)
  const firstWebsite = sites.length === 0

  return (
    <Container
      variant="report"
      className="space-y-6 py-5 pb-24 sm:py-7"
    >
      <Suspense fallback={null}>
        <DashboardCheckoutToast />
      </Suspense>

      <PageHeader title="Websites" />
      <section aria-labelledby="analyze-heading" className={styles.entry} data-first={firstWebsite}>
        <h2 id="analyze-heading" className={styles.title}>{firstWebsite ? WEBSITES_COPY.firstTitle : WEBSITES_COPY.analyzeTitle}</h2>
        <p className={styles.description}>
          {resumedUrl ? SCAN_HANDOFF.resuming(resumedUrl) : WEBSITES_COPY.analyzeBody}
        </p>
        <AuditInput
          idSuffix="-dashboard"
          source="dashboard"
          initialUrl={resumedUrl ?? undefined}
          autoStart={Boolean(resumedUrl)}
        />
        {firstWebsite && !resumedUrl ? <ol className={styles.steps}>
          {WEBSITES_COPY.firstSteps.map((step, index) => <li key={step.title}>
            <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
            <div><h3>{step.title}</h3><p>{step.body}</p></div>
          </li>)}
        </ol> : null}
      </section>
      {sites.length > 0 ? <SitesOverviewGrid sites={sites} /> : null}
    </Container>
  )
}
