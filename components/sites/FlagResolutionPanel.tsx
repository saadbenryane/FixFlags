import type { ReactNode } from 'react'
import { CheckCircle2, CircleAlert, CircleDashed, LoaderCircle } from 'lucide-react'
import { SiteFlagActions } from '@/components/sites/SiteFlagActions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import type { FlagProofNote, FlagResolution } from '@/lib/sites/flag-resolution'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { cn } from '@/lib/utils'

function ProofNote({ heading, proof, note, current = false }: { heading: string; proof: FlagProofNote; note?: string; current?: boolean }) {
  return (
    <section className="mt-4 rounded-2xl border border-border/80 bg-background p-5" aria-labelledby="flag-proof-heading">
      <h2 id="flag-proof-heading" className={current ? 'font-medium text-success' : 'font-medium'}>
        {heading}
      </h2>
      {note ? <p className="mt-2 text-sm text-muted-foreground">{note}</p> : null}
      <p className="mt-2 text-sm text-muted-foreground">
        {SITE_BOARD_COPY.flagProofLead} <time dateTime={proof.observedAt}>{formatEvidenceTimestamp(proof.observedAt) ?? 'Unknown time'}</time>. {proof.observation}
      </p>
      {proof.showAuditId ? <p className="mt-2 text-xs text-muted-foreground">Proof audit: {proof.auditId}</p> : null}
    </section>
  )
}

/** Status, dated proof, or the honest missing-proof next step for one Flag. */
export function FlagResolutionPanel({ resolution, siteId, flagId, children }: { resolution: FlagResolution; siteId: string; flagId: string; children?: ReactNode }) {
  return (
    <>
      <p role="status" className={cn('inline-flex min-h-8 items-center gap-2 rounded-full border bg-background px-3 text-sm font-medium', resolution.kind === 'proven' ? 'border-success text-success' : resolution.kind === 'unproven' ? 'border-border text-muted-foreground' : 'border-brand text-foreground')}>
        {resolution.kind === 'proven' ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : resolution.kind === 'verifying' ? <LoaderCircle className="h-4 w-4 animate-spin text-brand motion-reduce:animate-none" aria-hidden="true" /> : resolution.kind === 'open' ? <CircleAlert className="h-4 w-4 text-brand" aria-hidden="true" /> : <CircleDashed className="h-4 w-4" aria-hidden="true" />}
        {resolution.statusLabel}
      </p>
      {children}
      {resolution.kind === 'proven' ? <ProofNote heading={SITE_BOARD_COPY.flagRecovered} proof={resolution.proof} current /> : null}
      {resolution.kind === 'verifying' && resolution.proof ? <ProofNote heading={SITE_BOARD_COPY.flagProofLastCheck} proof={resolution.proof} note={resolution.runningNote} /> : null}
      {resolution.kind === 'unproven' ? (
        <section className="mt-4 rounded-2xl border border-border/80 bg-background p-5" aria-labelledby="flag-proof-missing-heading">
          <h2 id="flag-proof-missing-heading" className="font-medium">
            {resolution.statusLabel}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{resolution.body}</p>
          <div className="mt-5">
            <SiteFlagActions siteId={siteId} flagId={flagId} />
          </div>
        </section>
      ) : null}
    </>
  )
}
