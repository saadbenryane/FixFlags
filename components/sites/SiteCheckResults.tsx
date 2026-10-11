'use client'

import { useState } from 'react'
import { siteCheckPageSchema, type SiteCheckResult } from '@/lib/sites/check-results'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { SITE_BOARD_COPY as C, SITE_ACTION_COPY as A } from '@/lib/marketing/copy'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { Button } from '@/components/ui/button'
import { fetchSiteAction, siteActionMessage } from '@/lib/sites/client-actions'

export function SiteCheckResults({ results, siteId, area, nextCursor = null }: {
  results: SiteCheckResult[]; siteId?: string; area?: SiteCardArea; nextCursor?: string | null
}) {
  const [history, setHistory] = useState<SiteCheckResult[]>([])
  const [cursor, setCursor] = useState(nextCursor)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const all = [...new Map([...results, ...history].filter(result => !area || result.area === area).map(result => [result.id, result])).values()]
  async function loadMore() {
    if (busy || !cursor || !siteId) return
    setBusy(true); setMessage(null)
    try {
      const response = await fetchSiteAction(`/api/sites/${siteId}/check-results?cursor=${encodeURIComponent(cursor)}`)
      if (!response.ok) { setMessage(A.historyFailed); return }
      const page = siteCheckPageSchema.parse(await response.json())
      setHistory(previous => [...previous, ...page.results]); setCursor(page.nextCursor)
    } catch (error) { setMessage(siteActionMessage(error)) }
    finally { setBusy(false) }
  }
  if (!all.length && !cursor) return null
  return <section className="space-y-3">
    <h3 className="text-sm font-semibold">{C.recordedChecks}</h3>
    <p className="text-sm text-muted-foreground">{A.resultScope}</p>
    {[false, true].map(historical => {
      const group = all.filter(result => result.historical === historical)
      if (!group.length) return null
      return <div key={String(historical)} className="space-y-3">
        <h4 className="text-sm font-medium">{historical ? A.previousResults : A.currentResults}</h4>
        <ul className="space-y-3">{group.map(result => <li key={result.id} className="rounded-control border border-border p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2"><span className="font-medium">{result.name}</span><span>{C.checkResultStatuses[result.status]}</span></div>
          {result.observation ? <p className="mt-1">{result.observation}</p> : null}
          {result.pageUrl ? <p className="mt-1 break-all text-xs text-muted-foreground">{result.pageUrl}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground"><time dateTime={result.checkedAt}>{formatEvidenceTimestamp(result.checkedAt)}</time></p>
          <details className="mt-2"><summary className="flex min-h-11 cursor-pointer items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{C.verificationLimits}</summary>
            {result.expected ? <p className="mb-2">{A.expected}: {result.expected}</p> : null}
            <p className="text-muted-foreground">{result.limitation}</p>
            <dl className="mt-2 space-y-1 break-all text-xs text-muted-foreground"><div><dt>Source</dt><dd>{result.source}</dd></div><div><dt>Recorded execution</dt><dd>{result.evidenceReference.executionId}</dd></div><div><dt>Analysis</dt><dd>{result.auditId}</dd></div></dl>
          </details>
        </li>)}</ul>
      </div>
    })}
    {cursor && siteId ? <Button variant="outline" disabled={busy} onClick={() => void loadMore()}>{busy ? A.loading : A.moreResults}</Button> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </section>
}
