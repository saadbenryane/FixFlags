'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RESULT_SELECTION_CHANGED, siteCheckPageSchema, type SiteCheckResult } from '@/lib/sites/check-results'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { SITE_BOARD_COPY as C, SITE_ACTION_COPY as A } from '@/lib/marketing/copy-barrel'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { Button } from '@/components/ui/button'
import { fetchSiteAction, siteActionMessage } from '@/lib/sites/client-actions'
import { SearchResults } from './SearchResults'
import { presentCheckResult } from '@/lib/sites/check-result-presentation'

class ResultSelectionChanged extends Error {}

export function SiteCheckResults({ results, siteId, area, pageUrl, nextCursor = null }: {
  results: SiteCheckResult[]; siteId?: string; area?: SiteCardArea; pageUrl?: string; nextCursor?: string | null
}) {
  const [history, setHistory] = useState<SiteCheckResult[]>([])
  const [scoped, setScoped] = useState<SiteCheckResult[] | null>(null)
  const [cursor, setCursor] = useState(area || pageUrl ? null : nextCursor)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [initialFailed, setInitialFailed] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const generation = useRef(0)
  const invalidate = useCallback(() => { ++generation.current }, [])
  const initialPage = useRef({ results, nextCursor })
  initialPage.current = { results, nextCursor }
  const all = [...new Map([...(scoped ?? results), ...history].filter(result => (!area || result.area === area) && (!pageUrl || result.pageUrl === pageUrl)).map(result => [result.id, result])).values()]
  const selection = results.filter(result => !result.historical).map(result => `${result.auditId}:${result.checkedAt}`).join('|')
  const requestPage = useCallback(async (value: string | null, signal?: AbortSignal) => {
    const query = new URLSearchParams()
    if (value) query.set('cursor', value)
    if (area) query.set('area', area)
    if (pageUrl) query.set('pageUrl', pageUrl)
    const response = await fetchSiteAction(`/api/sites/${siteId}/check-results?${query}`, { signal })
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null)
      if (body && typeof body === 'object' && 'code' in body && body.code === RESULT_SELECTION_CHANGED) throw new ResultSelectionChanged()
      throw new Error(A.historyFailed)
    }
    return siteCheckPageSchema.parse(await response.json())
  }, [siteId, area, pageUrl])
  useEffect(() => {
    const current = ++generation.current
    setHistory([]); setScoped(null); setTotal(null); setCursor(area || pageUrl ? null : initialPage.current.nextCursor); setMessage(null); setInitialFailed(false); setBusy(false)
    if (!siteId || !(area || pageUrl)) return invalidate
    const controller = new AbortController()
    setBusy(true)
    void requestPage(null, controller.signal).then(page => {
      if (generation.current !== current || controller.signal.aborted) return
      setScoped(page.results); setTotal(page.total ?? null); setCursor(page.nextCursor); if (!page.results.length && page.nextCursor) setMessage(A.resultsBounded)
    }).catch(() => {
      if (generation.current !== current || controller.signal.aborted) return
      setInitialFailed(true); setMessage(A.historyFailed)
    }).finally(() => { if (generation.current === current && !controller.signal.aborted) setBusy(false) })
    return () => { controller.abort(); invalidate() }
  }, [siteId, area, pageUrl, selection, nextCursor, requestPage, invalidate])
  async function loadMore() {
    if (busy || (!cursor && !initialFailed) || !siteId) return
    const current = generation.current
    setBusy(true); setMessage(null)
    try {
      const page = await requestPage(initialFailed ? null : cursor)
      if (generation.current !== current) return
      if (initialFailed) { setScoped(page.results); setInitialFailed(false) }
      else setHistory(previous => [...previous, ...page.results])
      setCursor(page.nextCursor)
      setTotal(page.total ?? null)
      if (!page.results.length && page.nextCursor) setMessage(A.resultsBounded)
    } catch (error) {
      if (generation.current !== current) return
      if (error instanceof ResultSelectionChanged) {
        try {
          const fresh = await requestPage(null)
          if (generation.current !== current) return
          setHistory([]); setScoped(fresh.results); setCursor(fresh.nextCursor); setTotal(fresh.total ?? null)
          setInitialFailed(false); setMessage(A.resultsUpdated)
        } catch {
          if (generation.current !== current) return
          setHistory([]); setScoped(null); setCursor(null); setTotal(null); setInitialFailed(true); setMessage(A.historyFailed)
        }
      } else setMessage(error instanceof Error ? A.historyFailed : siteActionMessage(error))
    }
    finally { if (generation.current === current) setBusy(false) }
  }
  if (!all.length && !cursor && !busy && !message) return <p className="text-sm text-muted-foreground">{A.noRecordedResults}</p>
  return <section className="space-y-3">
    {busy ? <p role="status" className="text-sm text-muted-foreground">{A.loading}</p> : null}
    {total !== null ? <p className="text-xs text-muted-foreground">{A.resultsCount(all.length, total)}</p> : null}
    {all.some(result => result.search) ? <SearchResults results={all} /> : null}
    {all.some(result => !result.search) ? <>
      <h3 className="text-sm font-semibold">{C.recordedChecks}</h3>
      <p className="text-sm text-muted-foreground">{A.resultScope}</p>
    </> : null}
    {[false, true].map(historical => {
      const group = all.filter(result => !result.search && result.historical === historical)
      if (!group.length) return null
      return <div key={String(historical)} className="space-y-3">
        <h4 className="text-sm font-medium">{historical ? A.previousResults : A.currentResults}</h4>
        <ul className="space-y-3">{group.map(result => { const display = presentCheckResult(result); return <li key={result.id} className="rounded-control bg-muted/20 p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2"><span className="font-medium">{display.name}</span><span>{C.checkResultStatuses[result.status]}</span></div>
          {display.observation ? <p className="mt-1 leading-relaxed">{display.observation}</p> : null}
          {result.pageUrl ? <p className="mt-1 break-all text-xs text-muted-foreground">{result.pageUrl}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground"><time dateTime={result.checkedAt}>{formatEvidenceTimestamp(result.checkedAt)}</time></p>
          <details className="mt-2"><summary className="flex min-h-11 cursor-pointer items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{C.verificationLimits}</summary>
            {display.observation !== result.observation ? <p className="mb-2">{result.observation}</p> : null}
            {result.expected ? <p className="mb-2">{A.expected}: {result.expected}</p> : null}
            <p className="text-muted-foreground">{result.limitation}</p>
            <dl className="mt-2 space-y-1 break-all text-xs text-muted-foreground"><div><dt>Source</dt><dd>{result.source === 'browser-network' ? A.execution.tracking.source : result.source}</dd></div><div><dt>Recorded execution</dt><dd>{result.evidenceReference.executionId}</dd></div><div><dt>Analysis</dt><dd>{result.auditId}</dd></div></dl>
          </details>
        </li> })}</ul>
      </div>
    })}
    {(cursor || initialFailed) && siteId ? <Button variant="outline" disabled={busy} onClick={() => void loadMore()}>{busy ? A.loading : initialFailed ? A.retryResults : A.moreResults}</Button> : null}
    {!cursor && !busy && !message ? <p className="text-xs text-muted-foreground">{A.resultsExhausted}</p> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </section>
}
