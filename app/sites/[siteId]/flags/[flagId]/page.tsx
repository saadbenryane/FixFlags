import { prisma } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadSiteBoardFlag, loadSiteHome } from '@/lib/sites/application/queries'
import { listSiteOutcomes } from '@/lib/sites/outcomes'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { SiteShell } from '@/components/sites/SiteShell'
import { SiteFlagActions } from '@/components/sites/SiteFlagActions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { customerFlagContext } from '@/lib/sites/flag-label'
import { boardFlagPrompt } from '@/lib/sites/board-card'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { connectionLines, loadSiteConnectionViews } from '@/lib/sites/connections/read'
import { flagMatchesOutcome } from '@/lib/sites/outcome-state'

function attemptLabel(outcome: string | null): string {
  if (!outcome) return 'Verifying…'
  if (outcome === 'IMPROVED') return 'Verified'
  if (outcome === 'UNCHANGED') return 'Still open'
  if (outcome === 'REGRESSED') return 'Regressed'
  return "Couldn't verify"
}

export default async function SiteFlagPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; flagId: string }>
  searchParams: Promise<{ source?: string }>
}) {
  const { siteId, flagId } = await params
  const { source } = await searchParams
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()

  const resolvedId = access.decision.site.siteId
  const detail = await loadSiteBoardFlag(resolvedId, flagId)
  if (!detail) notFound()

  const { site, flag } = detail
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
  const connectionContext = site.projectId
    ? connectionLines((await loadSiteConnectionViews(site.projectId)).facts, flag.pageUrl)
    : []
  const relatedOutcome = outcomes.find((outcome) => flagMatchesOutcome(flag, outcome)) ?? null
  const home = await loadSiteHome(resolvedId)
  if (!home) notFound()

  const proofAudit = flag.resolvedInId && site.projectId
    ? await prisma.audit.findFirst({
        where: {
          id: flag.resolvedInId,
          projectId: site.projectId,
          status: 'COMPLETED',
        },
        select: { id: true, completedAt: true, createdAt: true },
      })
    : null

  return (
    <SiteShell
      siteId={resolvedId}
      activeRoute="flags"
      title={flag.problem}
      description={flag.whyItMatters}
      flagCount={home.flags.length}
      watch={home.watch}
      checking={flag.verifying}
    >
      <div className="mx-auto w-full max-w-3xl">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/sites/${resolvedId}/flags`}>Back to Flags</Link>
      </Button>
      <p className="text-xs text-muted-foreground">
        {site.canonicalHost} · {customerFlagContext(flag.area, flag.severity)}
      </p>
      <p className="mt-3 text-sm font-medium text-brand">{SITE_BOARD_COPY.flagStatus}</p>
      {relatedOutcome ? (
        <p className="mt-3 text-sm">
          <Link href={`/sites/${resolvedId}/outcomes/${relatedOutcome.id}`} className="underline">
            {relatedOutcome.name}
          </Link>
        </p>
      ) : null}

      <section className="mt-8 rounded-2xl border border-border/80 bg-background p-5">
        <h2 className="font-medium">Evidence</h2>
        {flag.evidenceMissing ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Evidence for this Flag was not stored. Verify will capture a fresh look at the same page.
          </p>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {flag.evidence}
          </p>
        )}
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">URL</dt>
            <dd className="mt-1">{flag.pageUrl ?? 'This Site, page not recorded'}</dd>
          </div>
          {flag.viewport ? (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Viewport</dt>
              <dd className="mt-1">{flag.viewport}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Expected after a fix</dt>
            <dd className="mt-1">{flag.expectedBehavior}</dd>
          </div>
        </dl>
      </section>

      {flag.status === 'FIXED' && flag.resolvedInId && proofAudit ? (
        <section className="mt-4 rounded-2xl border border-border/80 bg-background p-5" aria-labelledby="resolved-heading">
          <h2 id="resolved-heading" className="font-medium text-success">Resolved</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This Flag was verified as fixed by an independent check on{' '}
            <time dateTime={new Date(proofAudit.completedAt ?? proofAudit.createdAt).toISOString()}>
              {new Date(proofAudit.completedAt ?? proofAudit.createdAt).toLocaleString()}
            </time>
            . That check no longer found the problem.
          </p>
          {proofAudit.id !== flag.sourceAuditId ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Proof audit: {proofAudit.id}
            </p>
          ) : null}
        </section>
      ) : null}

      {connectionContext.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-border/80 bg-background p-5">
          <h2 className="font-medium">Connected context</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These numbers come from an account connected to this Site. They sit beside the Flag.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {connectionContext.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {flag.status !== 'FIXED' ? (
        <section className="mt-4 rounded-2xl border border-border/80 bg-background p-5">
          <p className="text-xs text-muted-foreground">
            Copying instructions does not close the Flag. Verify checks the same page and action again.
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {flag.fix}
          </p>
          <SiteFlagActions
            siteId={resolvedId}
            flagId={flag.id}
            fixText={flag.fix}
            promptText={boardFlagPrompt({
              problem: flag.problem,
              whyItMatters: flag.whyItMatters,
              evidence: flag.evidenceMissing ? null : flag.evidence,
              fix: flag.fix,
              pageUrl: flag.pageUrl,
              journeyName: relatedOutcome?.name,
              expectedBehavior: flag.expectedBehavior,
            })}
            verifying={flag.verifying}
          />
        </section>
      ) : null}

      <section className="mt-4 rounded-2xl border border-border/80 bg-background p-5">
        <h2 className="font-medium">Verification attempts</h2>
        {flag.attempts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No independent verify yet. Copy never resolves this Flag.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {flag.attempts.map((attempt) => (
              <li key={attempt.id}>
                <Surface variant="nested" className="text-sm">
                <p className="font-medium">{attemptLabel(attempt.outcome)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(attempt.createdAt).toLocaleString()} · {attempt.builder}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {attempt.changeSummary?.trim() || SITE_BOARD_COPY.changeUndescribed}
                </p>
                {attempt.reason ? (
                  <p className="mt-2 text-muted-foreground">{attempt.reason}</p>
                ) : null}
                </Surface>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </SiteShell>
  )
}
