import { prisma } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, ChevronLeft, CircleAlert, CircleDashed, ExternalLink, History, Target } from 'lucide-react'
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

function attemptLabel(attempt: { outcome: string | null; comparable: boolean | null; reason: string | null }): string {
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
  const detail = await loadSiteBoardFlag(resolvedId, flagId)
  if (!detail) notFound()

  const { site, flag, capture } = detail
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
  const home = await loadSiteHome(resolvedId)
  if (!home) notFound()

  const proofId = flagRecoveryProofId({
    status: flag.status,
    resolvedInId: flag.resolvedInId,
    attempts: flag.attempts,
  })
  const proofAudit =
    proofId && site.projectId
      ? await prisma.audit.findFirst({
          where: {
            id: proofId,
            projectId: site.projectId,
            status: 'COMPLETED',
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
    <SiteShell siteId={resolvedId} ownerId={site.userId} activeRoute="flags" title={flag.problem} description={flag.whyItMatters} presentation={home.presentation} watch={home.watch} checking={flag.verifying}>
      <div className="mx-auto w-full max-w-5xl lg:pr-24 2xl:pr-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground" asChild>
            <Link href={`/sites/${resolvedId}/flags`}>
              <ChevronLeft aria-hidden="true" />
              Back to Flags
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            {CARD_CATALOG[flag.area].name} · {flag.affectedPageCount} affected {flag.affectedPageCount === 1 ? 'page' : 'pages'}
          </p>
        </div>
        <FlagResolutionPanel resolution={resolution} siteId={resolvedId} flagId={flag.id}>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">{resolution.kind === 'proven' ? SITE_BOARD_COPY.recoveredBody : flag.whyItMatters}</p>
          {relatedOutcome ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Affects{' '}
              <Link href={`/sites/${resolvedId}/outcomes/${relatedOutcome.id}`} className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                {relatedOutcome.name}
              </Link>
            </p>
          ) : null}

          <div className={resolution.kind === 'open' || resolution.kind === 'verifying' ? 'mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start' : 'mt-6 space-y-6'}>
            <div className="space-y-6">
              <section className="overflow-hidden rounded-[17px] border border-border bg-background shadow-sm" aria-labelledby="flag-evidence-heading">
                <div className="flex items-center gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
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
                  {flag.evidenceMissing ? <p className="text-sm leading-relaxed text-muted-foreground">Evidence for this Flag was not stored. Verify will capture a fresh look at the same page.</p> : <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">{flag.evidence}</p>}
                  {capture ? <BoardDetails image={{ src: capture.url, alt: SITE_BOARD_COPY.flagCaptureAlt }} checkedAt={capture.recordedAt} checkedLabel={SITE_BOARD_COPY.captureRecorded} /> : null}
                  <div className="rounded-[13px] bg-muted p-4">
                    <div className="flex items-start gap-3">
                      <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground">{SITE_BOARD_COPY.flagExpected}</h3>
                        <p className="mt-1 text-sm leading-relaxed">{flag.expectedBehavior}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground">{SITE_BOARD_COPY.flagScope}</h3>
                    <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                      <div className={flag.viewport ? '' : 'sm:col-span-2'}>
                        <dt className="text-xs text-muted-foreground">{(flag.affectedPageCount ?? affectedPaths.length) > 1 ? 'Affected pages' : 'Page'}</dt>
                        <dd className="mt-1 min-w-0 break-words font-medium">
                          {affectedPaths.length === 1 ? (
                            <a href={affectedPaths[0]} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1.5 underline decoration-border underline-offset-4 hover:decoration-foreground"><span className="break-all">{affectedPaths[0]}</span><ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /></a>
                          ) : affectedPaths.length > 1 ? (
                            <details>
                              <summary className="min-h-11 cursor-pointer py-2 text-sm">View all {affectedPaths.length} pages</summary>
                              <ul className="space-y-2">{affectedPaths.map((path) => <li key={path}><a href={path} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1.5 underline decoration-border underline-offset-4 hover:decoration-foreground"><span className="break-all">{path}</span><ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /></a></li>)}</ul>
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

            {resolution.kind === 'open' || resolution.kind === 'verifying' ? (
              <aside className="rounded-[17px] border border-border bg-background p-5 shadow-sm sm:p-6 lg:sticky lg:top-6" aria-labelledby="fix-and-verify-heading">
                <h2 id="fix-and-verify-heading" className="text-lg font-semibold tracking-tight">
                  {SITE_BOARD_COPY.fixAndVerify}
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{flag.fix}</p>
                <div className="mt-6">
                  <SiteFlagActions siteId={resolvedId} flagId={flag.id} verifying={flag.verifying} />
                </div>
              </aside>
            ) : null}

            <section className="rounded-[17px] border border-border bg-background p-5 sm:p-6 lg:col-start-1" aria-labelledby="verification-history-heading">
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
                      <li key={attempt.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3 border-b border-border/70 pb-5 last:border-b-0 last:pb-0">
                        <AttemptIcon outcome={attempt.outcome} />
                        <div className="min-w-0">
                          <p className="font-medium">{attemptLabel(attempt)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {when ? <time dateTime={attempt.createdAt}>{when}</time> : 'Time not recorded'}
                            {' · '}
                            <span>{customerAttemptSource(attempt.builder)}</span>
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">{attempt.changeSummary?.trim() || SITE_BOARD_COPY.changeUndescribed}</p>
                          {attempt.reason ? <p className="mt-2 text-sm text-muted-foreground">{attempt.reason}</p> : null}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          </div>
        </FlagResolutionPanel>
      </div>
    </SiteShell>
  )
}
