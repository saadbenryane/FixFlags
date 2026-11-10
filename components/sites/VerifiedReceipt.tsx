import { Check } from 'lucide-react'
import type { FlagProofNote } from '@/lib/sites/flag-resolution'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { formatEvidenceTimestamp } from '@/lib/time/format'

const C = SITE_DASHBOARD_COPY.verifiedReceipt

/** How long the fix took, from the recorded problem to the confirming recheck. Null when either time is missing or out of order. */
export function fixedInLabel(foundAt: string | null, verifiedAt: string | null): string | null {
  if (!foundAt || !verifiedAt) return null
  const minutes = Math.round((Date.parse(verifiedAt) - Date.parse(foundAt)) / 60_000)
  if (!Number.isFinite(minutes) || minutes < 1) return null
  if (minutes < 60) return C.duration(minutes, 'minute')
  if (minutes < 48 * 60) return C.duration(Math.round(minutes / 60), 'hour')
  return C.duration(Math.round(minutes / (24 * 60)), 'day')
}

function pathOf(url: string | null) {
  if (!url) return null
  try { return new URL(url).pathname || '/' } catch { return url }
}

/** The receipt for a proven fix: what, where, when it was found and when an independent recheck confirmed it. */
export function VerifiedReceipt({ heading, proof, page, foundAt }: { heading: string; proof: FlagProofNote; page: string | null; foundAt: string | null }) {
  const path = pathOf(page)
  const fixedIn = fixedInLabel(foundAt, proof.observedAt)
  const rows = [
    path ? { label: C.page, value: path } : null,
    foundAt ? { label: C.found, value: <time dateTime={foundAt}>{formatEvidenceTimestamp(foundAt)}</time> } : null,
    proof.observedAt ? { label: C.verified, value: <time dateTime={proof.observedAt}>{formatEvidenceTimestamp(proof.observedAt)}</time> } : null,
    fixedIn ? { label: C.fixedIn, value: fixedIn } : null,
  ].filter((row): row is { label: string; value: React.ReactNode } => row !== null)
  return <section className="mt-4 rounded-2xl bg-success-muted p-5" aria-labelledby="flag-proof-heading">
    <p className="inline-flex -rotate-2 items-center gap-1.5 rounded-md bg-background px-2.5 py-1 text-xs font-bold tracking-wide text-foreground shadow-sm" aria-label={C.label}>
      <Check className="h-3.5 w-3.5 text-success" strokeWidth={3} aria-hidden="true" />{C.stamp}
    </p>
    <h2 id="flag-proof-heading" className="mt-3 font-display text-lg font-semibold text-foreground">{heading}</h2>
    {rows.length ? <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-sm">
      {rows.map(row => <div key={row.label} className="contents"><dt className="text-muted-foreground">{row.label}</dt><dd className="font-medium text-foreground">{row.value}</dd></div>)}
    </dl> : null}
    <p className="mt-3 text-sm text-muted-foreground">{proof.observation}</p>
    <p className="mt-1 text-xs text-muted-foreground">{C.independent}</p>
    {proof.showAuditId ? <details className="mt-2 text-xs text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">Check details</summary><p className="break-all">Check reference: {proof.auditId}</p></details> : null}
  </section>
}
