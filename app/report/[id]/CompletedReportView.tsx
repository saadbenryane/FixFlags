import Link from 'next/link'
import { AuditShell } from '@/components/layout/audit-shell'
import { ReportViewedTracker } from '@/components/analytics/ReportViewedTracker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Heading } from '@/components/ui/typography'
import { displayHostname } from '@/lib/utils/url-helpers'
import type { loadReportRouteState } from './load-report-route-state'

type CompletedState = Extract<
  Awaited<ReturnType<typeof loadReportRouteState>>,
  { kind: 'completed' | 'partial' }
>

/**
 * One-way compatibility surface for old report links. Owners are redirected
 * to their Site before this renders. It intentionally excludes scores, Agent,
 * fix prompts, workspace controls, and the retired report product model.
 */
export function CompletedReportView({ state }: { state: CompletedState }) {
  const hostname = displayHostname(state.audit.url)
  const visibleFlags = state.flags.slice(0, 5)

  return (
    <AuditShell session={state.session}>
      <ReportViewedTracker
        auditId={state.id}
        isOwner={false}
        accessState={state.isLoggedIn ? 'signed_in' : 'anonymous'}
        surface={state.shareToken ? 'shared' : 'focused'}
      />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:py-14">
        <header className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Saved evidence · {hostname}
          </p>
          <h1 className="text-balance font-sans text-3xl font-semibold tracking-heading sm:text-4xl">
            Evidence from an earlier FixFlags check
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            This compatibility page preserves the observations behind an old link. It is not the
            current health of the website. Current care lives in a private Site with Cards, Flags,
            Verify, and Watch.
          </p>
        </header>

        {visibleFlags.length > 0 ? (
          <section className="space-y-3" aria-labelledby="saved-flags-heading">
            <Heading as="h2" id="saved-flags-heading" className="text-lg">
              Saved observations
            </Heading>
            {visibleFlags.map((flag) => (
              <Card key={flag.id} variant="subtle">
                <CardHeader className="pb-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {flag.severity.toLowerCase()} Flag
                  </p>
                  <Heading as="h3" className="text-base">{flag.problem}</Heading>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {flag.evidence || 'The original evidence is no longer available.'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : (
          <Card variant="subtle" className="p-5">
            <p className="text-sm text-muted-foreground">
              No customer Flag was preserved for this earlier check. That does not prove the Site is healthy today.
            </p>
          </Card>
        )}

        <div className="flex flex-wrap gap-3 border-t border-border/60 pt-6">
          <Button asChild><Link href="/new">Analyze a website</Link></Button>
          <Button asChild variant="outline"><Link href="/docs/site-care">How Site care works</Link></Button>
        </div>
      </main>
    </AuditShell>
  )
}
