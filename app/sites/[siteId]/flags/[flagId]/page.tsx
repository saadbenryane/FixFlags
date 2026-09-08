import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadSiteBoardFlag } from '@/lib/sites/application/queries'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/Logo'
import { SiteFlagActions } from '@/components/sites/SiteFlagActions'

export default async function SiteFlagPage({
  params,
}: {
  params: Promise<{ siteId: string; flagId: string }>
}) {
  const { siteId, flagId } = await params
  const detail = await loadSiteBoardFlag(siteId, flagId)
  if (!detail) notFound()

  const { site, flag } = detail

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Logo variant="lockup" size="sm" />
        <Button variant="outline" size="sm" asChild>
          <Link href={`/sites/${siteId}`}>Back to board</Link>
        </Button>
      </div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {site.canonicalHost} · {flag.area} · {flag.severity.toLowerCase()}
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{flag.problem}</h1>
      <p className="mt-3 text-muted-foreground">{flag.whyItMatters}</p>

      <section className="mt-8 rounded-2xl border border-border/80 bg-background p-5">
        <h2 className="font-medium">What happened</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {flag.evidence}
        </p>
        {flag.pageUrl ? (
          <p className="mt-3 text-xs text-muted-foreground">Where: {flag.pageUrl}</p>
        ) : null}
      </section>

      <section className="mt-4 rounded-2xl border border-border/80 bg-background p-5">
        <h2 className="font-medium">Fix this</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {flag.fix}
        </p>
        <SiteFlagActions siteId={siteId} flagId={flag.id} fixText={flag.fix} />
      </section>
    </div>
  )
}
