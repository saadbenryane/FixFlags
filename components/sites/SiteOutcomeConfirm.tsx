'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OUTCOME_CONFIRMATION, OUTCOME_KIND_LABELS } from '@/lib/marketing/copy'
import { outcomeCoverageLabel, outcomeStatusLabel } from '@/lib/sites/outcome-state'
import { watchableOutcomeKinds } from '@/lib/sites/outcome-kinds'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'

/**
 * "Looks right / Edit corrects inferred intent", which `docs/workspace-interface.md`
 * requires and which no shipped surface offered.
 *
 * An inferred Outcome arrives as a sentence FixFlags read off the site, with no
 * kind and therefore no mechanism. Confirming the sentence alone is refused,
 * because an agreement with no way to verify it is worse than no agreement at
 * all. So the customer is asked the only question that can be answered: which of
 * the things FixFlags can actually watch is this? The answer is a kind, the kind
 * selects a real execution mechanism, and the sentence becomes a promise the
 * product can keep or honestly fail.
 *
 * Only watchable kinds are offered, so this control cannot recreate the dead end
 * it exists to remove: Settings used to say "Inferred, confirmation required"
 * with nothing the customer could do about it.
 */
function ConfirmKind({
  siteId,
  outcome,
  choices,
}: {
  siteId: string
  outcome: SiteOutcomeView
  choices: Array<'CHECKOUT' | 'SIGNUP' | 'LOGIN' | 'PASSWORD_RESET' | 'AVAILABILITY'>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(kind: string) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/sites/${siteId}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeId: outcome.id, confirmed: true, kind }),
      })
      if (!res.ok) {
        // The route answers 400 with the reason a confirmation was refused, and
        // that reason is the useful thing to show. It is never "not found".
        const body = (await res.json().catch(() => null)) as { message?: string } | null
        setMessage(body?.message ?? OUTCOME_CONFIRMATION.saveFailed)
        return
      }
      setMessage(OUTCOME_CONFIRMATION.saved)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 border-t border-border/40 pt-3">
      <fieldset disabled={busy}>
        <legend className="text-sm font-medium">{OUTCOME_CONFIRMATION.proposeHeading}</legend>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{OUTCOME_CONFIRMATION.proposeBody}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {choices.map((kind) => (
            <Button key={kind} size="sm" variant="outline" onClick={() => void save(kind)}>
              {OUTCOME_KIND_LABELS[kind]}
            </Button>
          ))}
        </div>
      </fieldset>
      {message ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  )
}

function RenameOutcome({ siteId, outcome }: { siteId: string; outcome: SiteOutcomeView }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(outcome.name)
  const [message, setMessage] = useState<string | null>(null)

  if (!editing) {
    return (
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(true)}>
        {OUTCOME_CONFIRMATION.edit}
      </Button>
    )
  }

  async function rename() {
    setBusy(true)
    setMessage(null)
    try {
      // A rename corrects the label only. It does not renew, withdraw or change
      // the customer's agreement about what FixFlags should execute.
      const res = await fetch(`/api/sites/${siteId}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', outcomeId: outcome.id, name }),
      })
      if (!res.ok) {
        setMessage(OUTCOME_CONFIRMATION.saveFailed)
        return
      }
      setMessage(OUTCOME_CONFIRMATION.renamed)
      setEditing(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void rename()
      }}
    >
      <label className="sr-only" htmlFor={`outcome-name-${outcome.id}`}>
        {OUTCOME_CONFIRMATION.nameLabel}
      </label>
      <input
        id={`outcome-name-${outcome.id}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm sm:w-64"
      />
      <Button type="submit" size="sm" disabled={busy}>
        {OUTCOME_CONFIRMATION.save}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
        {OUTCOME_CONFIRMATION.cancel}
      </Button>
      {message ? (
        <span role="status" className="text-sm text-muted-foreground">
          {message}
        </span>
      ) : null}
    </form>
  )
}

/**
 * The Outcome's own kind leads when FixFlags can watch it, because the site
 * already answered the question. Asking a customer to re-decide something the
 * scan settled would be the funnel-design task `docs/workspace-interface.md`
 * rules out.
 */
function offeredKinds(outcome: SiteOutcomeView) {
  const watchable = watchableOutcomeKinds()
  const own = outcome.kind as (typeof watchable)[number]
  if (outcome.kind !== 'GENERIC') return watchable.includes(own) ? [own] : []
  return watchable
}

/** One Outcome, with the choice that turns it into something FixFlags can check. */
export function SiteOutcomeRow({ siteId, outcome }: { siteId: string; outcome: SiteOutcomeView }) {
  const confirmed = outcome.confirmedAt !== null
  const choices = confirmed ? [] : offeredKinds(outcome)
  return (
    <li className="rounded-card border border-border/60 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{outcome.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {confirmed ? OUTCOME_CONFIRMATION.confirmedNote : OUTCOME_CONFIRMATION.inferredNote}
          </p>
          {confirmed ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                {outcomeCoverageLabel(outcome.environment, outcome.bindings)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{outcomeStatusLabel(outcome.state, outcome.running)}</p>
            </>
          ) : null}
        </div>
        {confirmed ? (
          <span className="inline-flex items-center gap-2 text-sm text-success">
            <Check className="h-4 w-4" aria-hidden />
            {OUTCOME_CONFIRMATION.confirmedBadge}
          </span>
        ) : null}
      </div>
      {confirmed ? (
        <div className="mt-2">
          <RenameOutcome siteId={siteId} outcome={outcome} />
        </div>
      ) : choices.length > 0 ? (
        <ConfirmKind siteId={siteId} outcome={outcome} choices={choices} />
      ) : (
        <p className="mt-3 border-t border-border/40 pt-3 text-sm text-muted-foreground">
          {OUTCOME_CONFIRMATION.unsupportedNote}
        </p>
      )}
    </li>
  )
}

export function SiteOutcomeConfirmList({ siteId, outcomes }: { siteId: string; outcomes: SiteOutcomeView[] }) {
  if (outcomes.length === 0) {
    return <p className="text-sm text-muted-foreground">{OUTCOME_CONFIRMATION.noneConfirmed}</p>
  }
  return (
    <ul className="mt-4 space-y-3">
      {outcomes.map((outcome) => (
        <SiteOutcomeRow key={outcome.id} siteId={siteId} outcome={outcome} />
      ))}
    </ul>
  )
}
