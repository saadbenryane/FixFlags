import type { ReactNode } from 'react'
import { SiteFlagActions } from '@/components/sites/SiteFlagActions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import type { FlagProofNote, FlagResolution } from '@/lib/sites/flag-resolution'
import { formatEvidenceTimestamp } from '@/lib/time/format'

function ProofNote({
  heading,
  proof,
  note,
  current = false,
}: {
  heading: string
  proof: FlagProofNote
  note?: string
  current?: boolean
}) {
  return (
    <section className="mt-4 rounded-2xl border border-border/80 bg-background p-5" aria-labelledby="flag-proof-heading">
      <h2 id="flag-proof-heading" className={current ? 'font-medium text-success' : 'font-medium'}>{heading}</h2>
      {note ? <p className="mt-2 text-sm text-muted-foreground">{note}</p> : null}
      <p className="mt-2 text-sm text-muted-foreground">
        {SITE_BOARD_COPY.flagProofLead}{' '}
        <time dateTime={proof.observedAt}>{formatEvidenceTimestamp(proof.observedAt) ?? 'Unknown time'}</time>
        . {proof.observation}
      </p>
      {proof.showAuditId ? (
        <p className="mt-2 text-xs text-muted-foreground">Proof audit: {proof.auditId}</p>
      ) : null}
    </section>
  )
}

/** Status, dated proof, or the honest missing-proof next step for one Flag. */
export function FlagResolutionPanel({
  resolution,
  siteId,
  flagId,
  fixText,
  promptText,
  children,
}: {
  resolution: FlagResolution
  siteId: string
  flagId: string
  fixText: string
  promptText?: string | null
  children?: ReactNode
}) {
  return (
    <>
      <p className="mt-3 text-sm font-medium text-brand">{resolution.statusLabel}</p>
      {children}
      {resolution.kind === 'proven' ? (
        <ProofNote heading={SITE_BOARD_COPY.flagRecovered} proof={resolution.proof} current />
      ) : null}
      {resolution.kind === 'verifying' && resolution.proof ? (
        <ProofNote
          heading={SITE_BOARD_COPY.flagProofLastCheck}
          proof={resolution.proof}
          note={resolution.runningNote}
        />
      ) : null}
      {resolution.kind === 'unproven' ? (
        <section className="mt-4 rounded-2xl border border-border/80 bg-background p-5" aria-labelledby="flag-proof-missing-heading">
          <h2 id="flag-proof-missing-heading" className="font-medium">{resolution.statusLabel}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{resolution.body}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{fixText}</p>
          <SiteFlagActions
            siteId={siteId}
            flagId={flagId}
            fixText={fixText}
            promptText={promptText}
          />
        </section>
      ) : null}
    </>
  )
}
