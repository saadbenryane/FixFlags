'use client'

import { InteractiveSelect } from '@/components/ui/interactive-controls'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { OutcomeFixtureView } from '@/lib/sites/application/outcome-fixtures'
import { executeSiteAction } from '@/lib/sites/client-actions'
import { useSiteAction } from '@/hooks/useSiteAction'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'

type Draft = {
  name: string
  targetUrl: string
  emailLabel: string
  emailValue: string
  passwordLabel: string
  passwordValue: string
  submitName: string
  successType: 'text' | 'url'
  successValue: string
  resetUrl: string
  cleanupUrl: string
  hookSecret: string
}

const EMPTY: Draft = {
  name: C.fixtures.defaults.name, targetUrl: '', emailLabel: C.fixtures.defaults.emailLabel, emailValue: '',
  passwordLabel: C.fixtures.defaults.passwordLabel, passwordValue: '', submitName: C.fixtures.defaults.submitName,
  successType: 'text', successValue: '', resetUrl: '', cleanupUrl: '', hookSecret: '',
}

export function SafeFormFixtures(props: { siteId: string; initial: OutcomeFixtureView[] }) {
  return <SafeFormFixturesContent key={props.siteId} {...props} />
}

function SafeFormFixturesContent({ siteId, initial }: { siteId: string; initial: OutcomeFixtureView[] }) {
  const router = useRouter()
  const [fixtures, setFixtures] = useState(initial)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const { busy, message, error, submit, isPending, requestKey, completeIntent } = useSiteAction({ namespace: `site:${siteId}:fixtures` })
  const [readMessage, setReadMessage] = useState<string | null>(null)
  const readSequence = useRef(0)
  const pendingSetup = fixtures.some(fixture => fixture.setupRun && ['QUEUED', 'WAITING', 'READY', 'RUNNING', 'RETRY_WAIT'].includes(fixture.setupRun.state))
  useEffect(() => {
    if (!pendingSetup) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      const sequence = ++readSequence.current
      try {
        const result = await executeSiteAction(`/api/sites/${siteId}/outcome-fixtures`, { cache: 'no-store', signal: controller.signal }, 'fixtures')
        if (!controller.signal.aborted && sequence === readSequence.current) { setFixtures(result.fixtures); setReadMessage(null) }
      } catch { if (!controller.signal.aborted && sequence === readSequence.current) setReadMessage(C.refreshPending) }
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 3000)
    }
    timer = setTimeout(() => void poll(), 1500)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [pendingSetup, siteId])

  async function refresh(signal: AbortSignal) {
    const sequence = ++readSequence.current
    const result = await executeSiteAction(`/api/sites/${siteId}/outcome-fixtures`, { cache: 'no-store', signal }, 'fixtures')
    if (signal.aborted) return
    if (sequence === readSequence.current) { setFixtures(result.fixtures); setReadMessage(null) }
    router.refresh()
  }

  function payload() {
    const fields: Record<string, { by: 'label'; value: string }> = {
      email: { by: 'label', value: draft.emailLabel },
    }
    const values: Record<string, string> = { email: draft.emailValue }
    if (draft.passwordLabel.trim()) {
      fields.password = { by: 'label', value: draft.passwordLabel }
      values.password = draft.passwordValue
    }
    return {
      name: draft.name,
      targetUrl: draft.targetUrl,
      fieldMapping: { fields, submit: { by: 'role', role: 'button', value: draft.submitName } },
      values,
      successCriterion: { type: draft.successType, value: draft.successValue },
      resetUrl: draft.resetUrl,
      cleanupUrl: draft.cleanupUrl,
      hookSecret: draft.hookSecret || undefined,
    }
  }

  async function save() {
    if (isPending()) return
    setReadMessage(null)
    await submit(async signal => {
      const body = await executeSiteAction(editing
        ? `/api/sites/${siteId}/outcome-fixtures/${editing}`
        : `/api/sites/${siteId}/outcome-fixtures`, {
        signal, method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      }, 'fixture')
      return body.fixture
    }, saved => {
      // Reads begun before this receipt cannot restore an older configuration.
      ++readSequence.current
      setFixtures((current) => editing
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved])
      setDraft(EMPTY)
      setEditing(null)
      setOpen(false)
      return C.fixtures.saved
    }, refresh)
  }

  async function action(fixture: OutcomeFixtureView, actionName: 'dry-run' | 'authorize' | 'revoke' | 'delete') {
    if (isPending()) return
    if (actionName === 'delete' && !window.confirm(C.fixtures.deleteConfirmation)) return
    setReadMessage(null)
    const intent = `setup:${fixture.id}:${fixture.version}`
    await submit(async signal => {
      const url = `/api/sites/${siteId}/outcome-fixtures/${fixture.id}${actionName === 'delete' ? '' : `/${actionName}`}`
      if (actionName === 'delete') {
        await executeSiteAction(url, { signal, method: 'DELETE' }, 'acknowledgement')
        return null
      } else {
        const body = await executeSiteAction(url, { signal, method: 'POST',
          ...(actionName === 'dry-run' ? { headers: { 'Idempotency-Key': requestKey(intent) } } : {}) }, 'fixture')
        return body.fixture
      }
    }, updated => {
      ++readSequence.current
      if (actionName === 'dry-run') completeIntent(intent)
      setFixtures(current => updated ? current.map(item => item.id === updated.id ? updated : item)
        : current.filter(item => item.id !== fixture.id))
      return actionName === 'dry-run' ? C.fixtures.dryRun : actionName === 'authorize' ? C.fixtures.authorized : actionName === 'revoke' ? C.fixtures.revoked : C.fixtures.deleted
    }, refresh)
  }

  function edit(fixture: OutcomeFixtureView) {
    const mapping = fixture.fieldMapping as { fields?: Record<string, { value?: string }>; submit?: { value?: string } }
    const success = fixture.successCriterion as { type?: 'text' | 'url'; value?: string }
    setDraft({
      name: fixture.name,
      targetUrl: fixture.targetUrl,
      emailLabel: mapping.fields?.email?.value ?? C.fixtures.defaults.emailLabel,
      emailValue: '',
      passwordLabel: mapping.fields?.password?.value ?? '',
      passwordValue: '',
      submitName: mapping.submit?.value ?? C.fixtures.defaults.submitName,
      successType: success.type === 'url' ? 'url' : 'text',
      successValue: success.value ?? '',
      resetUrl: fixture.resetUrl,
      cleanupUrl: fixture.cleanupUrl,
      hookSecret: '',
    })
    setEditing(fixture.id)
    setOpen(true)
  }

  return (
    <div className="mt-5 space-y-4">
      <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3" aria-label={C.fixtures.stepsLabel}>
        {C.fixtures.steps.map(step => <li key={step}>{step}</li>)}
      </ol>
      {fixtures.map((fixture) => {
        const dryRun = fixture.lastDryRunResult as { disposition?: string; reason?: string } | null
        const setupPending = fixture.setupRun && ['QUEUED', 'WAITING', 'READY', 'RUNNING', 'RETRY_WAIT'].includes(fixture.setupRun.state)
        const authorized = Boolean(fixture.authorizedAt && fixture.lastDryRunVersion === fixture.version)
        return (
          <article key={fixture.id} className="rounded-card bg-muted/35 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{fixture.name}</h3>
                <p className="mt-1 break-all text-xs text-muted-foreground">{fixture.targetUrl}</p>
                <p className="mt-2 text-sm">{setupPending ? fixture.setupRun?.state === 'RETRY_WAIT' ? C.fixtures.recovering : C.fixtures.pending : authorized ? C.fixtures.state.authorized : dryRun?.disposition === 'SUCCEEDED' ? C.fixtures.state.passed : dryRun ? C.fixtures.state.result(dryRun.disposition ?? '', dryRun.reason ?? null) : fixture.setupRun && ['FAILED', 'BLOCKED', 'EXHAUSTED'].includes(fixture.setupRun.state) ? C.fixtures.incomplete : C.fixtures.state.notRun}</p>
              </div>
              <span className="text-xs text-muted-foreground">{C.fixtures.version(fixture.version)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy || Boolean(setupPending)} onClick={() => void action(fixture, 'dry-run')}>{C.fixtures.actions.dryRun}</Button>
              {!authorized ? <Button size="sm" variant="brand" disabled={busy || Boolean(setupPending) || dryRun?.disposition !== 'SUCCEEDED' || fixture.lastDryRunVersion !== fixture.version} onClick={() => void action(fixture, 'authorize')}>{C.fixtures.actions.authorize}</Button> : <Button size="sm" variant="outline" disabled={busy} onClick={() => void action(fixture, 'revoke')}>{C.fixtures.actions.revoke}</Button>}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => edit(fixture)}>{C.fixtures.actions.replace}</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void action(fixture, 'delete')}>{C.fixtures.actions.delete}</Button>
            </div>
          </article>
        )
      })}

      {!open ? <Button variant="outline" onClick={() => { setDraft(EMPTY); setEditing(null); setOpen(true) }}>{C.fixtures.actions.add}</Button> : (
        <form className="rounded-card bg-muted/35 p-5" onSubmit={(event) => { event.preventDefault(); void save() }}>
          <h3 className="font-semibold">{editing ? C.fixtures.form.replaceTitle : C.fixtures.form.newTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{C.fixtures.form.body}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label={C.fixtures.form.name}><Input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
            <Field label={C.fixtures.form.targetUrl}><Input required type="url" value={draft.targetUrl} onChange={(event) => setDraft({ ...draft, targetUrl: event.target.value })} /></Field>
            <Field label={C.fixtures.form.emailLabel}><Input required value={draft.emailLabel} onChange={(event) => setDraft({ ...draft, emailLabel: event.target.value })} /></Field>
            <Field label={C.fixtures.form.emailValue}><Input required type="email" autoComplete="off" value={draft.emailValue} onChange={(event) => setDraft({ ...draft, emailValue: event.target.value })} /></Field>
            <Field label={C.fixtures.form.passwordLabel}><Input value={draft.passwordLabel} onChange={(event) => setDraft({ ...draft, passwordLabel: event.target.value })} /></Field>
            <Field label={C.fixtures.form.passwordValue}><Input required={Boolean(draft.passwordLabel)} type="password" autoComplete="new-password" value={draft.passwordValue} onChange={(event) => setDraft({ ...draft, passwordValue: event.target.value })} /></Field>
            <Field label={C.fixtures.form.submitName}><Input required value={draft.submitName} onChange={(event) => setDraft({ ...draft, submitName: event.target.value })} /></Field>
            <Field label={C.fixtures.form.successType}><InteractiveSelect className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm max-sm:text-base" value={draft.successType} onChange={(event) => setDraft({ ...draft, successType: event.target.value as Draft['successType'] })}><option value="text">{C.fixtures.form.visibleText}</option><option value="url">{C.fixtures.form.exactUrl}</option></InteractiveSelect></Field>
            <Field label={draft.successType === 'url' ? C.fixtures.form.successUrl : C.fixtures.form.successText}><Input required type={draft.successType === 'url' ? 'url' : 'text'} value={draft.successValue} onChange={(event) => setDraft({ ...draft, successValue: event.target.value })} /></Field>
            <Field label={C.fixtures.form.resetUrl}><Input required type="url" value={draft.resetUrl} onChange={(event) => setDraft({ ...draft, resetUrl: event.target.value })} /></Field>
            <Field label={C.fixtures.form.cleanupUrl}><Input required type="url" value={draft.cleanupUrl} onChange={(event) => setDraft({ ...draft, cleanupUrl: event.target.value })} /></Field>
            <Field label={C.fixtures.form.hookSecret}><Input type="password" autoComplete="off" value={draft.hookSecret} onChange={(event) => setDraft({ ...draft, hookSecret: event.target.value })} /></Field>
          </div>
          <div className="mt-4 flex gap-2"><Button type="submit" variant="brand" disabled={busy}>{busy ? C.fixtures.actions.saving : C.fixtures.actions.save}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{C.fixtures.actions.cancel}</Button></div>
        </form>
      )}
      {error || readMessage || message ? <p className="text-sm text-muted-foreground" role="status">{error?.message ?? readMessage ?? message}</p> : null}
      {error?.status === 401 ? <Button asChild variant="outline"><a target="_blank" rel="noopener noreferrer" href={`/sign-in?next=${encodeURIComponent(`/sites/${siteId}/settings`)}`}>{C.signInAction}</a></Button> : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-medium">{label}<span className="mt-1 block">{children}</span></label>
}
