'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { OUTCOME_CONFIRMATION, OUTCOME_KIND_LABELS } from '@/lib/marketing/copy-barrel'
import { watchableOutcomeKinds } from '@/lib/sites/outcome-kinds'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'

type ConfirmableKind = Exclude<ReturnType<typeof watchableOutcomeKinds>[number], 'SIGNUP'>

/**
 * Kinds an owner can confirm here. Signup coverage comes from automatic account
 * checks in Settings, so a Signup confirmation is never offered without the
 * authorized fixture the server requires for it.
 *
 * The Outcome's own kind leads when FixFlags can watch it, because the site
 * already answered the question.
 */
export function confirmableKinds(outcome: Pick<SiteOutcomeView, 'kind'>): ConfirmableKind[] {
  const available = watchableOutcomeKinds().filter((kind): kind is ConfirmableKind => kind !== 'SIGNUP')
  if (outcome.kind === 'GENERIC') return available
  return available.filter(kind => kind === outcome.kind)
}

/**
 * An inferred Outcome arrives as a sentence FixFlags read off the site, with no
 * mechanism. Confirming the sentence alone is refused, so the owner answers the
 * only question that can be answered: which watchable thing is this? The kind
 * selects a real execution mechanism, and the sentence becomes a promise the
 * product can keep or honestly fail.
 */
export function OutcomeConfirmControl({ siteId, outcome, onRefresh }: {
  siteId: string
  outcome: Pick<SiteOutcomeView, 'id' | 'kind' | 'confirmedAt'>
  onRefresh?: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  if (outcome.confirmedAt !== null) return null
  const choices = confirmableKinds(outcome)
  if (choices.length === 0) return <p className="text-sm text-muted-foreground">{OUTCOME_CONFIRMATION.unsupportedNote}</p>

  async function save(kind: ConfirmableKind) {
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
        // that reason is the useful thing to show.
        const body = (await res.json().catch(() => null)) as { message?: string } | null
        setMessage(body?.message ?? OUTCOME_CONFIRMATION.saveFailed)
        return
      }
      setMessage(OUTCOME_CONFIRMATION.saved)
      onRefresh?.()
      router.refresh()
    } catch {
      setMessage(OUTCOME_CONFIRMATION.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full">
      <fieldset disabled={busy}>
        <legend className="text-sm font-medium">{OUTCOME_CONFIRMATION.proposeHeading}</legend>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{OUTCOME_CONFIRMATION.proposeBody}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {choices.map(kind => (
            <Button key={kind} size="sm" variant="outline" onClick={() => void save(kind)}>
              {OUTCOME_KIND_LABELS[kind]}
            </Button>
          ))}
        </div>
      </fieldset>
      {message ? <p role="status" className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
    </div>
  )
}
