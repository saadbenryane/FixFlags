import type { Metadata } from 'next'
import { AuditPageClient } from '@/components/audit/AuditPageClient'
import { AuditShell } from '@/components/layout/audit-shell'
import { ReportWorkspaceState } from '@/components/report/ReportWorkspaceState'
import { BRAND, REPORT_COPY, SITE_URL } from '@/lib/marketing/copy'
import { getProgressiveAuditForRequest } from '@/lib/audit/fetch-audit'
import { displayHostname } from '@/lib/utils/url-helpers'
import { CompletedReportView } from './CompletedReportView'
import { loadReportRouteState } from './load-report-route-state'

export { loadReportRouteState }

interface Props {
  params: Promise<{ id: string }>
}

function topIssueFromFlags(
  flags: Array<{ severity: string; problem: string }>
): string | undefined {
  return flags.find((f) => f.severity === 'CRITICAL' || f.severity === 'IMPORTANT')?.problem
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const envelope = await getProgressiveAuditForRequest(id)
  if (envelope.kind !== 'completed') {
    return {
      title: 'FixFlags report',
      robots: { index: false, follow: false },
    }
  }
  const { audit } = envelope

  const isShareableOg = audit.isPublic || audit.userId === null

  if (!isShareableOg) {
    return {
      title: `${BRAND.name} report unavailable`,
      robots: { index: false, follow: false },
    }
  }

  const hostname = displayHostname(audit.url)

  const topIssue = topIssueFromFlags(audit.flags)
  const title = `${hostname} report · ${BRAND.name}`
  const description = topIssue
    ? `${topIssue}. Run your own check at ${BRAND.name}.`
    : audit.verdict?.slice(0, 140) ??
      `Automated FixFlags report with fix prompts. Run your own check at ${BRAND.name}.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/report/${id}` },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${SITE_URL}/report/${id}`,
      siteName: BRAND.name,
      images: [{ url: `/report/${id}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/report/${id}/opengraph-image`],
    },
  }
}

export async function ReportRoute({ params, shareToken }: Props & { shareToken?: string }) {
  const state = await loadReportRouteState(params, shareToken)
  if (state.kind === 'forbidden') {
    return (
      <AuditShell session={null}>
        <ReportWorkspaceState
          kind="forbidden"
          title={REPORT_COPY.workspace.unavailableState.privateTitle}
          description={REPORT_COPY.workspace.unavailableState.privateBody}
          actionLabel={REPORT_COPY.workspace.unavailableState.returnHome}
          actionHref="/"
        />
      </AuditShell>
    )
  }
  if (state.kind === 'progressive') {
    return (
      <AuditPageClient
        id={state.id}
        initialAudit={state.audit}
        pollStatus
        session={state.session}
        atAuditLimit={state.atAuditLimit}
      />
    )
  }

  return <CompletedReportView state={state} />
}

export default ReportRoute
