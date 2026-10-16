import { EDITOR_EVIDENCE_COPY } from '@/lib/marketing/copy/verification-evidence'
import type { ReactNode } from 'react'
import type { publicSupportingObservations } from '@/lib/audit/flag-observations'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { formatEvidenceTimestamp } from '@/lib/time/format'

/** Presentation is shared; sample actions and owner-authorized actions stay with their callers. */
export function FlagEvidenceDetails({ observed, expected, supportingObservations = [], supportingEvidenceUnreadable = false, factsClassName,
  observedLabel = SITE_ACTION_COPY.flagEvidence.observed, expectedLabel = SITE_ACTION_COPY.expected, children }: {
  observed: string | null; expected: string; supportingObservations?: ReturnType<typeof publicSupportingObservations>;
  supportingEvidenceUnreadable?: boolean; factsClassName?: string; observedLabel?: string; expectedLabel?: string; children?: ReactNode;
}) {
  return <>
    <dl className={factsClassName ?? 'space-y-5 text-sm'}>
      <div><dt className="text-xs font-medium text-muted-foreground">{observedLabel}</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{observed || SITE_ACTION_COPY.flagEvidence.missing}</dd></div>
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
