import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadSiteBoardFlag } from '@/lib/sites/application/queries'
import { listSiteOutcomes } from '@/lib/sites/outcomes'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { Logo } from '@/components/brand/Logo'
import { SiteFlagActions } from '@/components/sites/SiteFlagActions'
import { SiteOutcomeEdit } from '@/components/sites/SiteOutcomeEdit'

function certaintyLabel(value: string | null, confidence: number | null): string {
  if (value) return value.replaceAll('_', ' ').toLowerCase()
  if (confidence == null) return 'Not stated'
  if (confidence >= 0.8) return 'High'
  if (confidence >= 0.5) return 'Medium'
  return 'Low'
}

function attemptLabel(outcome: string | null): string {
  if (!outcome) return 'In progress'
  if (outcome === 'IMPROVED') return 'Passed'
  if (outcome === 'UNCHANGED' || outcome === 'REGRESSED') return 'Failed'
  return 'Inconclusive'
}

export default async function SiteFlagPage({
  params,
}: {
  params: Promise<{ siteId: string; flagId: string }>
}) {
  const { siteId, flagId } = await params
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()

  const resolvedId = access.decision.site.siteId
  const detail = await loadSiteBoardFlag(resolvedId, flagId)
  if (!detail) notFound()

  const { site, flag } = detail
  const outcomes = await listSiteOutcomes(site)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Logo variant="lockup" size="sm" />
        <Button variant="outline" size="sm" asChild>
          <Link href={`/sites/${resolvedId}`}>Back to board</Link>
        </Button>
      </div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {site.canonicalHost} · {flag.area} · {flag.severity.toLowerCase()}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{flag.problem}</h1>
      <p className="mt-3 text-muted-foreground">{flag.whyItMatters}</p>

      <section className="mt-8 rounded-2xl border border-border/80 bg-background p-5">
        <h2 className="font-medium">What happened</h2>
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
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Where</dt>
            <dd className="mt-1">{flag.pageUrl ?? 'This Site, page not recorded'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Viewport</dt>
            <dd className="mt-1">{flag.viewport ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Certainty</dt>
            <dd className="mt-1">{certaintyLabel(flag.causeCertainty, flag.confidence)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Expected after a fix</dt>
            <dd className="mt-1">{flag.expectedBehavior}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-4 rounded-2xl border border-border/80 bg-background p-5">
        <h2 className="font-medium">Outcome</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm or name what this Flag is getting in the way of.
        </p>
        <SiteOutcomeEdit siteId={resolvedId} outcomes={outcomes} />
      </section>

      <section className="mt-4 rounded-2xl border border-border/80 bg-background p-5">
        <h2 className="font-medium">Fix this</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Copying instructions does not close the Flag. Verify checks the same page and action again.
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {flag.fix}
        </p>
        <SiteFlagActions siteId={resolvedId} flagId={flag.id} fixText={flag.fix} />
      </section>

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
  )
}
