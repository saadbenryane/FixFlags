'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { RESULT_SELECTION_CHANGED, siteCheckPageSchema, type SiteCheckResult } from '@/lib/sites/check-result-contract'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { SITE_BOARD_COPY as C, SITE_ACTION_COPY as A } from '@/lib/marketing/copy-barrel'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { Button } from '@/components/ui/button'
import { fetchSiteActionJson, siteActionMessage } from '@/lib/sites/client-actions'
import { SearchResults } from './SearchResults'
import { presentCheckResult } from '@/lib/sites/check-result-presentation'
import { useContinuationFocus } from '@/hooks/useContinuationFocus'
import { RecordedPageLink } from './RecordedPageLink'

class ResultSelectionChanged extends Error {}

type ReadState = {
  history: SiteCheckResult[]; scoped: SiteCheckResult[] | null; cursor: string | null;
  busy: boolean; message: string | null; initialFailed: boolean; total: number | null;
}

export function SiteCheckResults({ results, siteId, area, pageUrl, nextCursor = null }: {
  results: SiteCheckResult[]; siteId?: string; area?: SiteCardArea; pageUrl?: string; nextCursor?: string | null
}) {
  const selection = results.filter(result => !result.historical).map(result => `${result.auditId}:${result.checkedAt}`).join('|')
  const scope = JSON.stringify([siteId, area, pageUrl, selection, nextCursor])
  const owner = useMemo<{ scope: string; initial: ReadState }>(() => ({ scope, initial: {
    history: [], scoped: null, cursor: area || pageUrl ? null : nextCursor,
    busy: Boolean(siteId && (area || pageUrl)), message: null, initialFailed: false, total: null,
  } }), [scope, siteId, area, pageUrl, nextCursor])
  const [state, setState] = useState(() => ({ owner, data: owner.initial }))
  const { history, scoped, cursor, busy, message, initialFailed, total } = state.owner === owner ? state.data : owner.initial
  const update = useCallback((patch: Partial<ReadState> | ((current: ReadState) => Partial<ReadState>)) => {
    setState(previous => {
      const current = previous.owner === owner ? previous.data : owner.initial
      return { owner, data: { ...current, ...(typeof patch === 'function' ? patch(current) : patch) } }
    })
  }, [owner])
  const generation = useRef(0)
  const requests = useRef(new Set<AbortController>())
  const continuing = useRef(false)
  const invalidate = useCallback(() => {
    ++generation.current
    for (const request of requests.current) request.abort()
    requests.current.clear()
    continuing.current = false
  }, [])
  // A new scope renders its own state immediately and retires requests at
  // commit. Existing result nodes can retain their keyboard reading position.
  useLayoutEffect(() => { ++generation.current; return invalidate }, [owner, invalidate])
  const all = [...new Map([...(scoped ?? results), ...history].filter(result => (!area || result.area === area) && (!pageUrl || result.pageUrl === pageUrl)).map(result => [result.id, result])).values()]
  const continuation = useContinuationFocus(scope, busy)
  const requestPage = useCallback(async (value: string | null) => {
    const query = new URLSearchParams()
    if (value) query.set('cursor', value)
    if (area) query.set('area', area)
    if (pageUrl) query.set('pageUrl', pageUrl)
    const controller = new AbortController()
    requests.current.add(controller)
    try {
      const { response, body } = await fetchSiteActionJson(`/api/sites/${siteId}/check-results?${query}`, { signal: controller.signal })
      if (!response.ok) {
        if (body && typeof body === 'object' && 'code' in body && body.code === RESULT_SELECTION_CHANGED) throw new ResultSelectionChanged()
        throw new Error(A.historyFailed)
      }
      return siteCheckPageSchema.parse(body)
    } finally { requests.current.delete(controller) }
  }, [siteId, area, pageUrl])
  useEffect(() => {
    const current = generation.current
    if (!siteId || !(area || pageUrl)) return
    update({ busy: true })
    void requestPage(null).then(page => {
      if (generation.current !== current) return
      update({ scoped: page.results, total: page.total ?? null, cursor: page.nextCursor,
        message: !page.results.length && page.nextCursor ? A.resultsBounded : null })
    }).catch(() => {
      if (generation.current !== current) return
      update({ initialFailed: true, message: A.historyFailed })
    }).finally(() => { if (generation.current === current) update({ busy: false }) })
  }, [siteId, area, pageUrl, requestPage, update])
  async function loadMore() {
    if (continuing.current || busy || (!cursor && !initialFailed) || !siteId) return
    const current = generation.current
    continuing.current = true
    update({ busy: true, message: null })
    try {
      const page = await requestPage(initialFailed ? null : cursor)
      if (generation.current !== current) return
      update(previous => ({ ...(initialFailed ? { scoped: page.results, initialFailed: false } : { history: [...previous.history, ...page.results] }),
        cursor: page.nextCursor, total: page.total ?? null, message: !page.results.length && page.nextCursor ? A.resultsBounded : null }))
    } catch (error) {
      if (generation.current !== current) return
      if (error instanceof ResultSelectionChanged) {
        try {
          const fresh = await requestPage(null)
          if (generation.current !== current) return
          update({ history: [], scoped: fresh.results, cursor: fresh.nextCursor, total: fresh.total ?? null,
            initialFailed: false, message: A.resultsUpdated })
        } catch {
          if (generation.current !== current) return
          update({ history: [], scoped: null, cursor: null, total: null, initialFailed: true, message: A.historyFailed })
        }
      } else update({ message: error instanceof Error ? A.historyFailed : siteActionMessage(error) })
    }
    finally { if (generation.current === current) { continuing.current = false; update({ busy: false }) } }
  }
  const empty = !all.length && !cursor && !busy && !message
  return <section ref={continuation.root} tabIndex={-1} aria-label={C.recordedChecks} className="space-y-3 rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    {empty ? <p className="text-sm text-muted-foreground">{A.noRecordedResults}</p> : <>
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
        <ul className="space-y-3">{group.map(result => { const display = presentCheckResult(result); return <li key={result.id} data-continuation-item tabIndex={-1} className="rounded-control bg-muted/20 p-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
          <div className="flex flex-wrap items-start justify-between gap-2"><span className="font-medium">{display.name}</span><span>{C.checkResultStatuses[result.status]}</span></div>
          {display.observation ? <p className="mt-1 leading-relaxed">{display.observation}</p> : null}
          {result.pageUrl ? <p className="mt-1 break-all text-xs text-muted-foreground"><RecordedPageLink url={result.pageUrl} className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-control underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" /></p> : null}
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
    {(cursor || initialFailed) && siteId ? <Button data-continuation-control variant="outline" disabled={busy} onClick={event => { continuation.begin(event.currentTarget); void loadMore() }}>{busy ? A.loading : initialFailed ? A.retryResults : A.moreResults}</Button> : null}
    {!cursor && !busy && !message ? <p className="text-xs text-muted-foreground">{A.resultsExhausted}</p> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    </>}
  </section>
}
