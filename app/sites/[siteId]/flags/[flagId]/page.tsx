import { repairGuidanceState } from '@/lib/improvements/repair-guidance'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { CheckCircle2, ChevronLeft, CircleAlert, CircleDashed, History } from 'lucide-react'
import { RecordedPageLink } from '@/components/sites/RecordedPageLink'
import { loadSiteBoardFlag, loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteResultsPage } from '@/lib/sites/page-access'
import { Button } from '@/components/ui/button'
import { SiteShell } from '@/components/sites/SiteShell'
import { SiteFlagActions } from '@/components/sites/SiteFlagActions'
import { SiteFlagDetailRefresh } from '@/components/sites/SiteFlagDetailRefresh'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { FLAG_PAGE_COPY, flagDeviceLabel } from '@/lib/marketing/copy/flag-page'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import { siteDetailContextHref, siteDetailReturnDestination, type SiteDetailOriginParams } from '@/lib/sites/workspace-location'
import { customerAttemptSource } from '@/lib/sites/flag-label'
import { customerFindingLabel } from '@/lib/sites/finding-label'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { connectionLines, loadSiteConnectionViews } from '@/lib/sites/connections/read'
import { flagMatchesOutcome } from '@/lib/sites/outcome-state'
import { flagRecoveryProofId, flagResolutionView } from '@/lib/sites/flag-resolution'
import { verificationResult, verificationResultLabel } from '@/lib/sites/presentation'
import { FlagResolutionPanel } from '@/components/sites/FlagResolutionPanel'
import { CARD_CATALOG } from '@/lib/sites/card-areas'
import { BoardDetails } from '@/components/sites/BoardDetails'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { FlagEvidenceDetails } from '@/components/sites/FlagEvidenceDetails'
import { SitePromptAccessActions } from '@/components/sites/SiteActionContinuation'
import styles from './FlagDetailPage.module.css'

function recordedPathLabel(url: string): string {
  try {
    const parsed = new URL(url)
    const path = `${parsed.pathname}${parsed.search}`
    return path === '/' ? parsed.host : path
  } catch {
    return url
  }
}

function attemptLabel(attempt: Parameters<typeof verificationResult>[0]): string {
  return verificationResultLabel(verificationResult(attempt))
}

function AttemptIcon({ attempt }: { attempt: Parameters<typeof verificationResult>[0] }) {
  const result = verificationResult(attempt)
  if (result === 'verified') return <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
  if (result === 'still_open' || result === 'regressed') return <CircleAlert className="h-5 w-5 text-brand" aria-hidden="true" />
  return <CircleDashed className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
}

export default async function SiteFlagPage({ params, searchParams }: { params: Promise<{ siteId: string; flagId: string }>; searchParams: Promise<SiteDetailOriginParams & { source?: string | string[] }> }) {
  const { siteId, flagId } = await params
  const origin = await searchParams
  const { source } = origin
  const access = await requireSiteResultsPage(siteId, `/sites/${encodeURIComponent(siteId)}/flags/${encodeURIComponent(flagId)}`)

  const resolvedId = access.decision.site.siteId
  const ownsSite = access.decision.role === 'owner'
  const connectionViewsPromise = access.decision.site.projectId ? loadSiteConnectionViews(access.decision.site.projectId) : Promise.resolve(null)
  void connectionViewsPromise.catch(() => undefined)
  const detailPromise = loadSiteBoardFlag(resolvedId, flagId, access.decision.site)
  const homePromise = loadSiteHome(resolvedId, { ownerEvidence: ownsSite, viewerAuthenticated: access.decision.authenticated, site: access.decision.site, connections: connectionViewsPromise })
  const detail = await detailPromise
  if (!detail) {
    await homePromise.catch(() => undefined)
    notFound()
  }

  const { site, flag, capture } = detail
  const returnDestination = siteDetailReturnDestination(resolvedId, flag.area, origin)
  const actionFlagId = flag.sourceFlagId ?? flag.id
  const repairGuidance = flag.repairGuidance ?? repairGuidanceState(flag)
  const affectedPaths = [...new Set(flag.affectedPaths?.length ? flag.affectedPaths : flag.pageUrl ? [flag.pageUrl] : [])]
  async function recordOpening() {
    if (ownsSite) {
      await recordSiteLifecycleEvent({
        name: 'flag_opened',
        idempotencyKey: `flag_opened:${site.projectId}:${flag.id}`,
        userId: site.userId,
        projectId: site.projectId,
        properties: { area: flag.area, severity: flag.severity },
      }).catch(() => undefined)
      if (source === 'watch-email') {
        await recordSiteLifecycleEvent({
          name: 'notification_returned',
          idempotencyKey: `notification_returned:${site.projectId}:${flag.id}`,
          userId: site.userId,
          projectId: site.projectId,
          properties: { destination: 'flag' },
        }).catch(() => undefined)
      }
    }
  }
  const [home, connectionViews] = await Promise.all([
    homePromise,
    connectionViewsPromise,
    recordOpening(),
  ])
  if (!home) notFound()
  const connectionContext = connectionLines(connectionViews?.facts ?? [], flag.pageUrl)
  const relatedOutcome = home.outcomes.find((outcome) => flagMatchesOutcome(flag, outcome)) ?? null

  const proofId = flagRecoveryProofId({
    status: flag.status,
    resolvedInId: flag.resolvedInId,
    sourceAuditId: flag.sourceAuditId,
    sourceFlagId: flag.sourceFlagId,
    attempts: flag.attempts,
  })
  const proofAudit =
    proofId && site.projectId
      ? await prisma.audit.findFirst({
          where: {
            id: proofId,
            projectId: site.projectId,
            status: 'COMPLETED',
            ...(!flag.resolvedInId ? { parentId: flag.sourceAuditId } : {}),
          },
          select: {
            id: true,
            status: true,
            completedAt: true,
            createdAt: true,
          },
        })
      : null
  const resolution = flagResolutionView({
    status: flag.status,
    resolvedInId: flag.resolvedInId,
    attemptProofId: flag.resolvedInId ? null : proofId,
    sourceAuditId: flag.sourceAuditId,
    verifying: flag.verifying,
    proof: proofAudit
      ? {
          id: proofAudit.id,
          status: proofAudit.status,
          completedAt: proofAudit.completedAt?.toISOString() ?? null,
          createdAt: proofAudit.createdAt.toISOString(),
        }
      : null,
  })
  const title = resolution.kind === 'proven'
    ? relatedOutcome?.kind === 'CHECKOUT' ? SITE_BOARD_COPY.checkoutRecovered
      : relatedOutcome?.kind === 'AVAILABILITY' ? SITE_BOARD_COPY.pageRecovered
        : SITE_BOARD_COPY.problemRecovered
    : customerFindingLabel(flag)

  const plainTitle = customerFindingLabel(flag)
  const showActions = ownsSite && (resolution.kind === 'open' || resolution.kind === 'verifying')
  const linkClass = 'inline-flex min-h-11 max-w-full items-center gap-1.5 break-all underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring'

  return (
    <SiteShell actions={home.actions} siteId={resolvedId} activeRoute={returnDestination.view} title={title} description={resolution.kind === 'proven' ? SITE_BOARD_COPY.recoveredBody : flag.whyItMatters} presentation={home.presentation} analysisView={home} watch={home.watch} chatFlag={{ id: flag.id, title: plainTitle }}>
      <SiteFlagDetailRefresh key={`${resolvedId}:${flagId}`} siteId={resolvedId} flagId={flagId} sourceFlagId={actionFlagId} initial={home} />
      <div className={`mx-auto w-full max-w-5xl ${styles.layout}`}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="justify-start px-0 text-muted-foreground" asChild>
            <Link href={returnDestination.href as Route}>
              <ChevronLeft aria-hidden="true" />
              {SITE_DASHBOARD_COPY.backTo(SITE_WORKSPACE_COPY.navigation[returnDestination.view])}
            </Link>
          </Button>
          {/* The one place this Flag's page and device appear. */}
          <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
            {affectedPaths.length === 1
              ? <RecordedPageLink url={affectedPaths[0]} className={linkClass}>{FLAG_PAGE_COPY.where(recordedPathLabel(affectedPaths[0]), flagDeviceLabel(flag.viewport))}</RecordedPageLink>
              : FLAG_PAGE_COPY.where(affectedPaths.length > 1 ? FLAG_PAGE_COPY.pages(affectedPaths.length) : CARD_CATALOG[flag.area].name, flagDeviceLabel(flag.viewport))}
          </p>
        </div>
        <FlagResolutionPanel repairGuidance={repairGuidance} resolution={resolution} siteId={resolvedId} flagId={actionFlagId} referenceFlagId={flagId} initial={home} verificationFeedback={ownsSite && !['DISMISSED', 'IGNORED'].includes(flag.status) ? flag.verificationFeedback : null} receipt={{ page: flag.pageUrl, foundAt: flag.latestOccurrenceAt }}>
          {relatedOutcome ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {FLAG_PAGE_COPY.affects}{' '}
              <Link href={siteDetailContextHref(`/sites/${resolvedId}/outcomes/${encodeURIComponent(relatedOutcome.id)}`, returnDestination.origin) as Route} className="inline-flex min-h-11 max-w-full items-center font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                {relatedOutcome.name}
              </Link>
            </p>
          ) : null}

          <div className={`${styles.evidenceGrid} ${showActions ? styles.withActions : ''}`}>
            {/* The next action leads on phones and sits beside the evidence on wide screens. */}
            {showActions ? (
              <aside className={`rounded-board-panel border-0 bg-background p-5 shadow-board sm:p-6 lg:sticky lg:top-6 ${styles.actions}`} aria-labelledby="fix-and-verify-heading">
                <h2 id="fix-and-verify-heading" className="text-lg font-semibold tracking-tight">
                  {SITE_BOARD_COPY.fixAndVerify}
                </h2>
                <div className="mt-6">
                  <SiteFlagActions repairGuidance={repairGuidance} initialFix={flag.fix} sourceAuditId={flag.sourceAuditId} siteId={resolvedId} flagId={actionFlagId} referenceFlagId={flagId} initial={home} initialVerificationAuditId={flag.activeVerificationAuditId} verifying={flag.verifying} />
                </div>
              </aside>
            ) : null}
            {!ownsSite ? <div className={styles.actions}><SitePromptAccessActions availability={home.actions.copy} destination={`/sites/${resolvedId}/flags/${flag.id}`} label={SITE_BOARD_COPY.copyPrompt} /></div> : null}

            <div className={`space-y-6 ${styles.main}`}>
              <section className="rounded-board-panel border-0 bg-background p-5 shadow-board sm:p-6" aria-labelledby="flag-evidence-heading">
                <h2 id="flag-evidence-heading" className="font-semibold">
                  {resolution.kind === 'proven' ? SITE_BOARD_COPY.previousFailure : SITE_BOARD_COPY.flagEvidence}
                </h2>
                {resolution.kind === 'proven' ? <p className="mt-1 text-sm text-muted-foreground">{plainTitle}</p> : null}
                <div className="mt-5 space-y-5">
                  <FlagEvidenceDetails observed={flag.evidenceMissing ? null : flag.evidence} expected={flag.expectedBehavior} diagnosis={flag.problem}
                    observedLabel={FLAG_PAGE_COPY.observed} expectedLabel={FLAG_PAGE_COPY.expected}
                    supportingObservations={flag.supportingObservations} supportingEvidenceUnreadable={flag.supportingEvidenceUnreadable} />
                  {capture ? <BoardDetails image={{ src: capture.url, alt: SITE_BOARD_COPY.flagCaptureAlt }} checkedAt={capture.recordedAt} checkedLabel={SITE_BOARD_COPY.captureRecorded} /> : null}
                  {affectedPaths.length > 1 ? <details className="text-sm">
                    <summary className="flex min-h-11 cursor-pointer items-center font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{FLAG_PAGE_COPY.viewAll(affectedPaths.length)}</summary>
                    <ul className="mt-2 space-y-1">{affectedPaths.map((path) => <li key={path}><RecordedPageLink url={path} className={linkClass}>{recordedPathLabel(path)}</RecordedPageLink></li>)}</ul>
                  </details> : null}
                  {flag.performanceEvidenceSource ? <div className="space-y-3 rounded-control bg-muted/30 p-4 text-sm">
                    <p>{SITE_ACTION_COPY.flagEvidence[flag.performanceEvidenceSource]}</p>
                    {flag.performanceEvidence?.length ? <details>
                      <summary className="flex min-h-11 cursor-pointer items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{SITE_ACTION_COPY.flagEvidence.conditions}</summary>
                      <ul className="space-y-3">{flag.performanceEvidence.map((measurement, index) => <li key={index}>
                        <p>{[measurement.strategy, measurement.formFactor, measurement.throttlingMethod, measurement.lighthouseVersion ? FLAG_PAGE_COPY.lighthouse(measurement.lighthouseVersion) : null].filter(Boolean).join(', ')}</p>
                        <p className="text-xs text-muted-foreground">{measurement.measuredAt ? SITE_ACTION_COPY.flagEvidence.measured : SITE_ACTION_COPY.flagEvidence.received}: <time dateTime={measurement.measuredAt ?? measurement.receivedAt}>{formatEvidenceTimestamp(measurement.measuredAt ?? measurement.receivedAt)}</time></p>
                      </li>)}</ul>
                    </details> : <p className="text-xs text-muted-foreground">{SITE_ACTION_COPY.flagEvidence.conditionsUnknown}</p>}
                    {flag.pageUrl ? <a className="inline-flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(flag.pageUrl)}`} target="_blank" rel="noopener noreferrer">{SITE_ACTION_COPY.flagEvidence.retestPerformance}</a> : null}
                  </div> : null}
                  {flag.evidenceContext ? <details className="text-sm">
                    <summary className="flex min-h-11 cursor-pointer items-center font-medium text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{FLAG_PAGE_COPY.details}</summary>
                    <dl className="mt-3 space-y-3 text-xs text-muted-foreground">
                      <div><dt>{FLAG_PAGE_COPY.foundBy}</dt><dd className="text-foreground">{SITE_ACTION_COPY.flagEvidence.sources[flag.evidenceContext.source as keyof typeof SITE_ACTION_COPY.flagEvidence.sources] ?? SITE_ACTION_COPY.flagEvidence.unknown}</dd></div>
                      {flag.evidenceContext.recordedAt ? <div><dt>{FLAG_PAGE_COPY.found}</dt><dd className="text-foreground"><time dateTime={flag.evidenceContext.recordedAt}>{formatEvidenceTimestamp(flag.evidenceContext.recordedAt)}</time></dd></div> : null}
                      {flag.evidenceContext.references.length ? <div><dt>{FLAG_PAGE_COPY.elements}</dt><dd><ul className="mt-1 space-y-2">{flag.evidenceContext.references.map((reference, index) => <li key={index} className="break-words font-mono text-foreground">{[reference.label, reference.selector, reference.device].filter(Boolean).join(', ')}</li>)}</ul></dd></div> : null}
                    </dl>
                  </details> : null}
                </div>
              </section>

              {connectionContext.length > 0 ? (
                <section className="rounded-board-panel border-0 bg-background p-5 shadow-board sm:p-6">
                  <h2 className="font-semibold">{FLAG_PAGE_COPY.connectedTitle}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{FLAG_PAGE_COPY.connectedBody}</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {connectionContext.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* Rechecks appear once there is one; the fix steps already say how to start. */}
              {ownsSite && flag.attempts.length > 0 ? <section className="rounded-board-panel border-0 bg-background p-5 shadow-board sm:p-6" aria-labelledby="verification-history-heading">
                <div className="flex flex-wrap items-center gap-3">
                  <History className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <h2 id="verification-history-heading" className="min-w-0 flex-1 basis-48 [overflow-wrap:anywhere] font-semibold">
                    {SITE_BOARD_COPY.verificationHistory}
                  </h2>
                </div>
                <ol className="mt-5 space-y-5">
                  {flag.attempts.map((attempt) => {
                    const when = formatEvidenceTimestamp(attempt.createdAt)
                    return (
                      <li id={`attempt-${attempt.id}`} key={attempt.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3">
                        <AttemptIcon attempt={attempt} />
                        <div className="min-w-0">
                          <p className="font-medium">{attemptLabel(attempt)}</p>
                          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                            {when ? <time dateTime={attempt.createdAt}>{when}</time> : <span>{FLAG_PAGE_COPY.timeNotRecorded}</span>}
                            <span>{customerAttemptSource(attempt.builder)}</span>
                          </p>
                          {attempt.changeSummary?.trim() ? <p className="mt-2 text-sm text-muted-foreground">{attempt.changeSummary}</p> : null}
                          {attempt.reason ? <p className="mt-2 text-sm text-muted-foreground">{attempt.reason}</p> : null}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </section> : null}
            </div>
          </div>
        </FlagResolutionPanel>
      </div>
    </SiteShell>
  )
}
