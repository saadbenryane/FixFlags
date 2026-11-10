'use client'

import { useState } from 'react'
import type { SiteCheckResult } from '@/lib/sites/check-result-contract'
import { groupRecordedSearchResults } from '@/lib/sites/search-result-groups'
import { SEARCH_COPY as C } from '@/lib/marketing/copy/search'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { Button } from '@/components/ui/button'
import { useContinuationFocus } from '@/hooks/useContinuationFocus'
import { RecordedPageLink } from './RecordedPageLink'

export function SearchResults({ results }: { results: SiteCheckResult[] }) {
  const [limits, setLimits] = useState<Record<string, number>>({})
  const facts = groupRecordedSearchResults(results)
  const current = facts.filter(fact => !fact.result.historical)
  const previous = facts.filter(fact => fact.result.historical)
  const partial = current.some(fact => fact.result.search?.disposition === 'unknown')
  const continuation = useContinuationFocus(JSON.stringify([...new Set(results.map(result => result.auditId))]))
  return <section ref={continuation.root} tabIndex={-1} className="space-y-4 rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={C.recorded}>
    <h3 className="text-sm font-semibold">{C.recorded}</h3>
    <p className="text-sm text-muted-foreground">{C.introduction}</p>
    {partial ? <p role="status" className="text-sm text-muted-foreground">{C.partial}</p> : null}
    {[{ key: 'current', values: current }, { key: 'previous', values: previous }].map(({ key, values }) => {
      if (!values.length) return null
      return <section key={key} className="space-y-4">
        {key === 'previous' ? <h4 className="text-sm font-semibold">{C.previous}</h4> : null}
        {Object.entries(C.groups).map(([responsibility, label]) => {
          const items = values.filter(fact => fact.result.search?.responsibility === responsibility)
          if (!items.length) return null
          const limitKey = `${key}:${responsibility}`, limit = limits[limitKey] ?? 10
          return <section key={responsibility} className="space-y-3">
            <h4 className="text-sm font-medium">{label}</h4>
            <ul className="space-y-3">{items.slice(0, limit).map(({ result, executions }) => {
              const item = result.search!
              return <li key={result.id} data-continuation-item tabIndex={-1} className="rounded-control border border-border p-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{C.statuses[item.disposition]}</span>
                </div>
                <p className="mt-2 break-words">{item.observed}</p>
                <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground"><span>{C.sources[item.source]}</span><time dateTime={item.collectedAt}>{formatEvidenceTimestamp(item.collectedAt)}</time></p>
                <p className="mt-1 break-all text-xs text-muted-foreground"><RecordedPageLink url={item.pageUrl} className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-control underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" /></p>
                <details className="mt-2">
                  <summary className="flex min-h-11 cursor-pointer items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{C.evidence}</summary>
                  <p className="mt-2">{C.expected}: {item.expected}</p>
                  <p className="mt-2 text-muted-foreground">{item.limitation}</p>
                  {item.google ? <dl className="mt-3 space-y-2 text-xs">
                    <div><dt>{C.property}</dt><dd className="break-all">{item.google.property}</dd></div>
                    {item.google.lastCrawlAt ? <div><dt>{C.lastCrawl}</dt><dd><time dateTime={item.google.lastCrawlAt}>{formatEvidenceTimestamp(item.google.lastCrawlAt)}</time></dd></div> : null}
                    {item.google.dateRange ? <div><dt>{C.reportingWindow}</dt><dd>{item.google.dateRange}</dd></div> : null}
                  </dl> : null}
                  <dl className="mt-3 space-y-2 text-xs">
                    {item.evidence.map((evidence, index) => <div key={index}>
                      <dt className="font-medium">{C.sources[evidence.source]}: {evidence.locator}</dt>
                      <dd className="mt-1 break-all"><RecordedPageLink url={evidence.url} className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-control underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" /></dd>
                      <dd className="mt-1 whitespace-pre-wrap break-words">{evidence.excerpt}</dd>
                    </div>)}
                    <div><dt>{C.execution}</dt><dd className="space-y-1 break-all">{executions.map(id => <p key={id}>{id}</p>)}</dd></div>
                  </dl>
                  {item.attention.kind !== 'observation' ? <div className="mt-3">
                    <h5 className="font-medium">{C.guidance}</h5><p className="mt-1 break-words">{item.guidance}</p>
                  </div> : null}
                  {responsibility === 'structured-data' ? <div className="mt-3 space-y-2">
                    <a className="flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                      href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(item.pageUrl)}`} target="_blank" rel="noopener noreferrer">{C.richResults}</a>
                    <a className="flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                      href="https://validator.schema.org/" target="_blank" rel="noopener noreferrer">{C.schemaValidator}</a>
                  </div> : null}
                </details>
              </li>
            })}</ul>
            {items.length > limit ? <Button data-continuation-control variant="outline" onClick={event => { continuation.begin(event.currentTarget); setLimits(previous => ({ ...previous, [limitKey]: limit + 10 })) }}>{C.more}</Button> : null}
          </section>
        })}
      </section>
    })}
  </section>
}
