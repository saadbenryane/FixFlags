import { repairGuidanceState } from '@/lib/improvements/repair-guidance'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, ChevronLeft, CircleAlert, CircleDashed, ExternalLink, History } from 'lucide-react'
import { loadSiteBoardFlag, loadSiteHome } from '@/lib/sites/application/queries'
import { listSiteOutcomes } from '@/lib/sites/outcomes'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { Button } from '@/components/ui/button'
import { SiteShell } from '@/components/sites/SiteShell'
import { SiteFlagActions } from '@/components/sites/SiteFlagActions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { customerAttemptSource } from '@/lib/sites/flag-label'
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
import { SiteActionContinuation } from '@/components/sites/SiteActionContinuation'
import styles from './FlagDetailPage.module.css'

function attemptLabel(attempt: Parameters<typeof verificationResult>[0]): string {
  return verificationResultLabel(verificationResult(attempt))
}

function AttemptIcon({ outcome }: { outcome: string | null }) {
  if (outcome === 'IMPROVED') return <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
  if (outcome === 'UNCHANGED' || outcome === 'REGRESSED') return <CircleAlert className="h-5 w-5 text-brand" aria-hidden="true" />
  return <CircleDashed className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
}

export default async function SiteFlagPage({ params, searchParams }: { params: Promise<{ siteId: string; flagId: string }>; searchParams: Promise<{ source?: string }> }) {
  const { siteId, flagId } = await params
  const { source } = await searchParams
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()

  const resolvedId = access.decision.site.siteId
  const ownsSite = access.decision.role === 'owner'
  const detail = await loadSiteBoardFlag(resolvedId, flagId)
  if (!detail) notFound()

  const { site, flag, capture } = detail
  const actionFlagId = flag.sourceFlagId ?? flag.id
  const repairGuidance = flag.repairGuidance ?? repairGuidanceState(flag)
  const affectedPaths = flag.affectedPaths ?? (flag.pageUrl ? [flag.pageUrl] : [])
  if (access.decision.role === 'owner') {
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
  const outcomes = await listSiteOutcomes(site)
  const connectionContext = site.projectId ? connectionLines((await loadSiteConnectionViews(site.projectId)).facts, flag.pageUrl) : []
  const relatedOutcome = outcomes.find((outcome) => flagMatchesOutcome(flag, outcome)) ?? null
  const home = await loadSiteHome(resolvedId, { ownerEvidence: access.decision.role === 'owner', viewerAuthenticated: access.decision.authenticated })
  if (!home) notFound()

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
    : flag.problem

  return (
    <SiteShell actions={home.actions} siteId={resolvedId} ownerId={site.userId} activeRoute="home" title={title} description={resolution.kind === 'proven' ? SITE_BOARD_COPY.recoveredBody : flag.whyItMatters} presentation={home.presentation} analysisView={home} watch={home.watch} checking={flag.verifying} chatFlag={{ id: flag.id, title: flag.problem }}>
      <div className={`mx-auto w-full max-w-5xl ${styles.layout}`}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground" asChild>
            <Link href={`/sites/${resolvedId}?category=${flag.area}#category-${flag.area}`}>
              <ChevronLeft aria-hidden="true" />
              Back to Overview
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            {CARD_CATALOG[flag.area].name} · {flag.affectedPageCount} affected {flag.affectedPageCount === 1 ? 'page' : 'pages'}
          </p>
        </div>
        <FlagResolutionPanel repairGuidance={repairGuidance} resolution={resolution} siteId={resolvedId} flagId={actionFlagId} initial={home}>
          {relatedOutcome ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Affects{' '}
              <Link href={`/sites/${resolvedId}/outcomes/${relatedOutcome.id}`} className="inline-flex min-h-11 max-w-full items-center font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                {relatedOutcome.name}
              </Link>
            </p>
          ) : null}

          <div className={`${styles.evidenceGrid} ${resolution.kind === 'open' || resolution.kind === 'verifying' ? styles.withActions : ''}`}>
            <div className="space-y-6">
              <section className="overflow-hidden rounded-[17px] border border-border bg-background shadow-sm" aria-labelledby="flag-evidence-heading">
                <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-brand text-brand">
                    <CircleAlert className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 id="flag-evidence-heading" className="font-semibold">
                      {resolution.kind === 'proven' ? SITE_BOARD_COPY.previousFailure : SITE_BOARD_COPY.flagEvidence}
                    </h2>
                    <p className="text-xs text-muted-foreground">{resolution.kind === 'proven' ? flag.problem : SITE_BOARD_COPY.flagObserved}</p>
                  </div>
                </div>
                <div className="space-y-5 p-5 sm:p-6">
                  <FlagEvidenceDetails observed={flag.evidenceMissing ? null : flag.evidence} expected={flag.expectedBehavior}
                    supportingObservations={flag.supportingObservations} supportingEvidenceUnreadable={flag.supportingEvidenceUnreadable} />
                  {flag.evidenceContext ? <details className="text-sm">
                    <summary className="flex min-h-11 cursor-pointer items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{SITE_ACTION_COPY.evidence}</summary>
                    <dl className="mt-3 space-y-3 text-xs text-muted-foreground">
                      <div><dt>{SITE_ACTION_COPY.flagEvidence.source}</dt><dd>{SITE_ACTION_COPY.flagEvidence.sources[flag.evidenceContext.source as keyof typeof SITE_ACTION_COPY.flagEvidence.sources] ?? SITE_ACTION_COPY.flagEvidence.unknown}</dd></div>
                      {flag.evidenceContext.recordedAt ? <div><dt>{SITE_ACTION_COPY.flagEvidence.recorded}</dt><dd><time dateTime={flag.evidenceContext.recordedAt}>{formatEvidenceTimestamp(flag.evidenceContext.recordedAt)}</time></dd></div> : null}
                      {flag.evidenceContext.references.length ? <div><dt>{SITE_ACTION_COPY.flagEvidence.references}</dt><dd><ul className="mt-2 space-y-2">{flag.evidenceContext.references.map((reference, index) => <li key={index} className="break-words">{[reference.label, reference.selector, reference.device].filter(Boolean).join(' · ')}</li>)}</ul></dd></div> : null}
                    </dl>
                  </details> : null}
                  {flag.performanceEvidenceSource ? <div className="space-y-3 rounded-control bg-muted/30 p-4 text-sm">
                    <p>{SITE_ACTION_COPY.flagEvidence[flag.performanceEvidenceSource]}</p>
                    {flag.performanceEvidence?.length ? <details>
                      <summary className="flex min-h-11 cursor-pointer items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{SITE_ACTION_COPY.flagEvidence.conditions}</summary>
                      <ul className="space-y-3">{flag.performanceEvidence.map((measurement, index) => <li key={index}>
                        <p>{[measurement.strategy, measurement.formFactor, measurement.throttlingMethod, measurement.lighthouseVersion ? `Lighthouse ${measurement.lighthouseVersion}` : null].filter(Boolean).join(' · ')}</p>
                        <p className="text-xs text-muted-foreground">{measurement.measuredAt ? SITE_ACTION_COPY.flagEvidence.measured : SITE_ACTION_COPY.flagEvidence.received}: <time dateTime={measurement.measuredAt ?? measurement.receivedAt}>{formatEvidenceTimestamp(measurement.measuredAt ?? measurement.receivedAt)}</time></p>
                      </li>)}</ul>
                    </details> : <p className="text-xs text-muted-foreground">{SITE_ACTION_COPY.flagEvidence.conditionsUnknown}</p>}
                    {flag.pageUrl ? <a className="inline-flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(flag.pageUrl)}`} target="_blank" rel="noopener noreferrer">{SITE_ACTION_COPY.flagEvidence.retestPerformance}</a> : null}
                  </div> : null}
                  {capture ? <BoardDetails image={{ src: capture.url, alt: SITE_BOARD_COPY.flagCaptureAlt }} checkedAt={capture.recordedAt} checkedLabel={SITE_BOARD_COPY.captureRecorded} /> : null}
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground">{SITE_BOARD_COPY.flagScope}</h3>
                    <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                      <div className={flag.viewport ? '' : 'sm:col-span-2'}>
                        <dt className="text-xs text-muted-foreground">{(flag.affectedPageCount ?? affectedPaths.length) > 1 ? 'Affected pages' : 'Page'}</dt>
                        <dd className="mt-1 min-w-0 break-words font-medium">
                          {affectedPaths.length === 1 ? (
                            <a href={affectedPaths[0]} target="_blank" rel="noreferrer" className="inline-flex min-h-11 max-w-full items-start gap-1.5 underline decoration-border underline-offset-4 hover:decoration-foreground"><span className="min-w-0 break-all">{affectedPaths[0]}</span><ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /></a>
                          ) : affectedPaths.length > 1 ? (
                            <details>
                              <summary className="min-h-11 cursor-pointer py-2 text-sm">View all {affectedPaths.length} pages</summary>
                              <ul className="space-y-2">{affectedPaths.map((path) => <li key={path}><a href={path} target="_blank" rel="noreferrer" className="inline-flex min-h-11 max-w-full items-start gap-1.5 underline decoration-border underline-offset-4 hover:decoration-foreground"><span className="min-w-0 break-all">{path}</span><ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /></a></li>)}</ul>
                            </details>
                          ) : (
                            'This Site, page not recorded'
                          )}
                        </dd>
                      </div>
                      {flag.viewport ? (
                        <div>
                          <dt className="text-xs text-muted-foreground">Viewport</dt>
                          <dd className="mt-1 font-medium">{flag.viewport}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </div>
              </section>

              {connectionContext.length > 0 ? (
                <section className="rounded-[17px] border border-border bg-background p-5 sm:p-6">
                  <h2 className="font-semibold">Connected context</h2>
                  <p className="mt-1 text-sm text-muted-foreground">These numbers come from an account connected to this Site. They sit beside the Flag.</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {connectionContext.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            {ownsSite && (resolution.kind === 'open' || resolution.kind === 'verifying') ? (
              <aside className="rounded-[17px] border border-border bg-background p-5 shadow-sm sm:p-6 lg:sticky lg:top-6" aria-labelledby="fix-and-verify-heading">
                <h2 id="fix-and-verify-heading" className="text-lg font-semibold tracking-tight">
                  {SITE_BOARD_COPY.fixAndVerify}
                </h2>
                {repairGuidance === 'ready' ? <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{flag.fix}</p> : null}
                <div className="mt-6">
                  <SiteFlagActions repairGuidance={repairGuidance} siteId={resolvedId} flagId={actionFlagId} initial={home} initialVerificationAuditId={flag.attempts.find(attempt => attempt.verifying && attempt.sourceAuditId === flag.sourceAuditId)?.verificationAuditId ?? null} verifying={flag.verifying} />
                </div>
              </aside>
            ) : null}

            {!ownsSite ? <SiteActionContinuation availability={home.actions.copy} destination={`/sites/${resolvedId}/flags/${flag.id}`} action="copy" /> : null}
            {ownsSite ? <section className="rounded-[17px] border border-border bg-background p-5 sm:p-6 lg:col-start-1" aria-labelledby="verification-history-heading">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 id="verification-history-heading" className="font-semibold">
                  {SITE_BOARD_COPY.verificationHistory}
                </h2>
              </div>
              {flag.attempts.length === 0 ? (
                <div className="mt-4 rounded-[13px] bg-muted p-4">
                  <p className="text-sm font-medium">{SITE_BOARD_COPY.noVerificationYet}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{SITE_BOARD_COPY.noVerificationBody}</p>
                </div>
              ) : (
                <ol className="mt-5 space-y-5">
                  {flag.attempts.map((attempt) => {
                    const when = formatEvidenceTimestamp(attempt.createdAt)
                    return (
                      <li id={`attempt-${attempt.id}`} key={attempt.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
                        <AttemptIcon outcome={attempt.outcome} />
                        <div className="min-w-0">
                          <p className="font-medium">{attemptLabel(attempt)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {when ? <time dateTime={attempt.createdAt}>{when}</time> : 'Time not recorded'}
                            {' · '}
                            <span>{customerAttemptSource(attempt.builder)}</span>
                          </p>
                          {attempt.changeSummary?.trim() ? <p className="mt-2 text-sm text-muted-foreground">{attempt.changeSummary}</p> : null}
                          {attempt.reason ? <p className="mt-2 text-sm text-muted-foreground">{attempt.reason}</p> : null}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section> : null}
          </div>
        </FlagResolutionPanel>
      </div>
    </SiteShell>
  )
}
