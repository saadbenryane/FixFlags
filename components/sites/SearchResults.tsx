'use client'

import { useState } from 'react'
import type { SiteCheckResult } from '@/lib/sites/check-results'
import { SEARCH_COPY as C } from '@/lib/marketing/copy/search'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { Button } from '@/components/ui/button'

export function SearchResults({ results }: { results: SiteCheckResult[] }) {
  const [limits, setLimits] = useState<Record<string, number>>({})
  const current = results.filter(result => result.search && !result.historical)
  const previous = results.filter(result => result.search && result.historical)
  const partial = current.some(result => result.search?.disposition === 'unknown')
  return <section className="space-y-4" aria-label={C.recorded}>
    <h3 className="text-sm font-semibold">{C.recorded}</h3>
    <p className="text-sm text-muted-foreground">{C.introduction}</p>
    {partial ? <p role="status" className="text-sm text-muted-foreground">{C.partial}</p> : null}
    {[{ key: 'current', values: current }, { key: 'previous', values: previous }].map(({ key, values }) => {
      if (!values.length) return null
      return <section key={key} className="space-y-4">
        {key === 'previous' ? <h4 className="text-sm font-semibold">{C.previous}</h4> : null}
        {Object.entries(C.groups).map(([responsibility, label]) => {
          const items = values.filter(result => result.search?.responsibility === responsibility)
          if (!items.length) return null
          const limitKey = `${key}:${responsibility}`, limit = limits[limitKey] ?? 10
          return <section key={responsibility} className="space-y-3">
            <h4 className="text-sm font-medium">{label}</h4>
            <ul className="space-y-3">{items.slice(0, limit).map(result => {
              const item = result.search!
              return <li key={result.id} className="rounded-control border border-border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{C.statuses[item.disposition]}</span>
                </div>
                <p className="mt-2 break-words">{item.observed}</p>
                <p className="mt-2 text-xs text-muted-foreground">{C.sources[item.source]} · <time dateTime={item.collectedAt}>{formatEvidenceTimestamp(item.collectedAt)}</time></p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{item.pageUrl}</p>
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
                      <dt className="font-medium">{C.sources[evidence.source]} · {evidence.locator}</dt>
                      <dd className="mt-1 break-all">{evidence.url}</dd>
                      <dd className="mt-1 whitespace-pre-wrap break-words">{evidence.excerpt}</dd>
                    </div>)}
                    <div><dt>{C.execution}</dt><dd className="break-all">{result.evidenceReference.executionId}</dd></div>
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
            {items.length > limit ? <Button variant="outline" onClick={() => setLimits(previous => ({ ...previous, [limitKey]: limit + 10 }))}>{C.more}</Button> : null}
          </section>
        })}
      </section>
    })}
  </section>
}
