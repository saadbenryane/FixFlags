import { EDITOR_EVIDENCE_COPY } from '@/lib/marketing/copy/verification-evidence'
import type { ReactNode } from 'react'
import type { publicSupportingObservations } from '@/lib/audit/flag-observations'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { presentObservedEvidence, type ObservedPage } from '@/lib/sites/observed-evidence'
import { formatEvidenceTimestamp } from '@/lib/time/format'

function ObservedPageRow({ page }: { page: ObservedPage }) {
  return <li className="min-w-0">
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <a href={page.url} target="_blank" rel="noreferrer" className="flex min-h-11 min-w-11 max-w-full items-center break-all underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{page.label}</a>
      {page.valueLabel ? <span className="shrink-0 font-medium tabular-nums">{page.valueLabel}</span> : null}
    </div>
    {page.share != null ? <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(12, Math.round(page.share * 100))}%` }} /></span> : null}
    {page.valueLabel ? null : <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{page.note}</p>}
  </li>
}

function ObservedFact({ text }: { text: string }) {
  const presented = presentObservedEvidence(text)
  if (presented.kind === 'text') return <p className="whitespace-pre-wrap break-words leading-relaxed">{text}</p>
  const visible = presented.pages.slice(0, 4)
  const rest = presented.pages.slice(4)
  return <div className="space-y-3">
    {presented.summary ? <p className="leading-relaxed">{presented.summary}</p> : null}
    <ul className="space-y-3">{visible.map((page, index) => <ObservedPageRow key={`${page.url}:${index}`} page={page} />)}</ul>
    {presented.trailing ? <p className="text-xs text-muted-foreground">{presented.trailing}</p> : null}
    {rest.length ? <details>
      <summary className="flex min-h-11 cursor-pointer items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">View all {presented.pages.length} pages</summary>
      <ul className="mt-2 space-y-2">{rest.map((page, index) => <ObservedPageRow key={`${page.url}:${index}`} page={page} />)}</ul>
    </details> : null}
  </div>
}

/** Presentation is shared; sample actions and owner-authorized actions stay with their callers. */
export function FlagEvidenceDetails({ observed, expected, supportingObservations = [], supportingEvidenceUnreadable = false, factsClassName,
  observedLabel = SITE_ACTION_COPY.flagEvidence.observed, expectedLabel = SITE_ACTION_COPY.expected, children }: {
  observed: string | null; expected: string; supportingObservations?: ReturnType<typeof publicSupportingObservations>;
  supportingEvidenceUnreadable?: boolean; factsClassName?: string; observedLabel?: string; expectedLabel?: string; children?: ReactNode;
}) {
  return <>
    <dl className={factsClassName ?? 'space-y-5 text-sm'}>
      <div><dt className="text-xs font-medium text-muted-foreground">{observedLabel}</dt>
        <dd className="mt-1">{observed ? <ObservedFact text={observed} /> : <p className="leading-relaxed">{SITE_ACTION_COPY.flagEvidence.missing}</p>}</dd></div>
      <div><dt className="text-xs font-medium text-muted-foreground">{expectedLabel}</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{expected}</dd></div>
    </dl>
    {supportingEvidenceUnreadable ? <p className="mt-5 text-sm text-muted-foreground">{EDITOR_EVIDENCE_COPY.unreadable}</p> : null}
    {supportingObservations.length > 1 ? <details className="mt-5 text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{SITE_ACTION_COPY.flagEvidence.supporting}</summary>
      <ul className="mt-3 space-y-4">{supportingObservations.map((item, index) => <li key={index} className="space-y-1 rounded-control bg-muted/30 p-4">
        {item.pageUrl ? <p className="break-words text-xs text-muted-foreground">{item.pageUrl}</p> : null}
        <p className="whitespace-pre-wrap break-words leading-relaxed">{item.evidence}</p>
        {item.recordedAt ? <time className="text-xs text-muted-foreground" dateTime={item.recordedAt}>{formatEvidenceTimestamp(item.recordedAt)}</time> : null}
        {item.references.length ? <p className="break-words text-xs text-muted-foreground">{item.references.map(reference => [reference.label, reference.selector, reference.device].filter(Boolean).join(' · ')).join('; ')}</p> : null}
      </li>)}</ul>
    </details> : null}
    {children}
  </>
}
