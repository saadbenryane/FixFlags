'use client'

import { InteractiveSelect } from '@/components/ui/interactive-controls'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { OUTCOME_CONFIRMATION, OUTCOME_KIND_LABELS } from '@/lib/marketing/copy-barrel'
import { watchableOutcomeKinds } from '@/lib/sites/outcome-kinds'
import { executeSiteAction } from '@/lib/sites/client-actions'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'
import type { OutcomeFixtureView } from '@/lib/sites/application/outcome-fixtures'

type ConfirmableKind = ReturnType<typeof watchableOutcomeKinds>[number]

/** A Signup Outcome needs the current version of a dry-run, authorized fixture. */
export function usableSignupFixtures(fixtures: readonly OutcomeFixtureView[]) {
  return fixtures.filter(fixture => Boolean(fixture.authorizedAt) && fixture.enabled && fixture.lastDryRunVersion === fixture.version)
}

/**
 * Kinds an owner can confirm. Signup is offered only with a usable fixture, because
 * the server refuses a Signup confirmation without one. The Outcome's own kind
 * leads when FixFlags can watch it, because the site already answered the question.
 */
export function confirmableKinds(outcome: Pick<SiteOutcomeView, 'kind'>, hasSignupFixture = false): ConfirmableKind[] {
  const available = watchableOutcomeKinds().filter(kind => kind !== 'SIGNUP' || hasSignupFixture)
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
export function OutcomeConfirmControl({ siteId, outcome, onRefresh, fixtures: provided }: {
  siteId: string
  outcome: Pick<SiteOutcomeView, 'id' | 'kind' | 'confirmedAt'>
  onRefresh?: () => void
  fixtures?: OutcomeFixtureView[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<OutcomeFixtureView[]>([])
  const needsFixtures = provided === undefined && outcome.confirmedAt === null && (outcome.kind === 'GENERIC' || outcome.kind === 'SIGNUP')
  useEffect(() => {
    if (!needsFixtures) return
    const controller = new AbortController()
    executeSiteAction(`/api/sites/${siteId}/outcome-fixtures`, { cache: 'no-store', signal: controller.signal }, 'fixtures')
      .then(result => { if (!controller.signal.aborted) setLoaded(result.fixtures) })
      // Without readable fixtures, Signup stays unavailable; the other kinds still work.
      .catch(() => undefined)
    return () => controller.abort()
  }, [needsFixtures, siteId])
  const signupFixtures = usableSignupFixtures(provided ?? loaded)
  const [fixtureId, setFixtureId] = useState('')
  const selectedFixture = signupFixtures.find(fixture => fixture.id === fixtureId) ?? signupFixtures[0]
  if (outcome.confirmedAt !== null) return null
  const choices = confirmableKinds(outcome, signupFixtures.length > 0)
  if (choices.length === 0) return <p className="text-sm text-muted-foreground">{OUTCOME_CONFIRMATION.unsupportedNote}</p>

  async function save(kind: ConfirmableKind) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/sites/${siteId}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeId: outcome.id, confirmed: true, kind, ...(kind === 'SIGNUP' && selectedFixture ? { fixtureId: selectedFixture.id } : {}) }),
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
        {choices.includes('SIGNUP') && signupFixtures.length > 1 ? (
          <label className="mt-3 block max-w-sm text-sm font-medium">
            {OUTCOME_CONFIRMATION.signupFixture}
            <InteractiveSelect className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 max-sm:text-base" value={selectedFixture?.id ?? ''} onChange={event => setFixtureId(event.target.value)}>
              {signupFixtures.map(fixture => <option key={fixture.id} value={fixture.id}>{fixture.name}</option>)}
            </InteractiveSelect>
          </label>
        ) : null}
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
