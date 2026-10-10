import type { SiteCheckResult } from '@/lib/sites/check-results'
import { SITE_BOARD_COPY as C } from '@/lib/marketing/copy'
import { formatEvidenceTimestamp } from '@/lib/time/format'

export function SiteCheckResults({ results }: { results: SiteCheckResult[] }) {
  if (!results.length) return null
  return <section className="space-y-3">
    <h3 className="text-sm font-semibold">{C.recordedChecks}</h3>
    <p className="text-sm text-muted-foreground">{C.recordedChecksBody}</p>
    <ul className="space-y-3">{results.map(result => <li key={result.id} className="rounded-control border border-border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="font-medium">{result.name}</span>
        <span>{C.checkResultStatuses[result.status]}</span>
      </div>
      {result.observation ? <p className="mt-1">{result.observation}</p> : null}
      {result.pageUrl ? <p className="mt-1 break-all text-xs text-muted-foreground">{result.pageUrl}</p> : null}
      <p className="mt-1 text-xs text-muted-foreground">{result.historical ? C.previousEvidence : C.lastChecked} · <time dateTime={result.checkedAt}>{formatEvidenceTimestamp(result.checkedAt)}</time></p>
      <details className="mt-2"><summary className="flex min-h-11 cursor-pointer items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{C.verificationLimits}</summary><p className="text-muted-foreground">{result.limitation}</p></details>
    </li>)}</ul>
  </section>
}
