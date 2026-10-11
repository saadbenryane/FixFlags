'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { OutcomeFixtureView } from '@/lib/sites/application/outcome-fixtures'
import { fetchSiteAction, siteActionMessage } from '@/lib/sites/client-actions'

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
  name: 'Signup verification', targetUrl: '', emailLabel: 'Email', emailValue: '',
  passwordLabel: 'Password', passwordValue: '', submitName: 'Create account',
  successType: 'text', successValue: '', resetUrl: '', cleanupUrl: '', hookSecret: '',
}

export function SafeFormFixtures({ siteId, initial }: { siteId: string; initial: OutcomeFixtureView[] }) {
  const router = useRouter()
  const [fixtures, setFixtures] = useState(initial)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetchSiteAction(editing
        ? `/api/sites/${siteId}/outcome-fixtures/${editing}`
        : `/api/sites/${siteId}/outcome-fixtures`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      const body = await response.json().catch(() => ({})) as { fixture?: OutcomeFixtureView; error?: string }
      if (!response.ok || !body.fixture) {
        setMessage(body.error ?? 'Could not save this fixture.')
        return
      }
      setFixtures((current) => editing
        ? current.map((item) => item.id === body.fixture!.id ? body.fixture! : item)
        : [...current, body.fixture!])
      setMessage('Fixture saved. Run it safely before authorizing it.')
      setDraft(EMPTY)
      setEditing(null)
      setOpen(false)
      router.refresh()
    } catch (error) {
      setMessage(siteActionMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function action(fixture: OutcomeFixtureView, actionName: 'dry-run' | 'authorize' | 'revoke' | 'delete') {
    if (actionName === 'delete' && !window.confirm('Delete this fixture and disable the Outcome method that uses it?')) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetchSiteAction(`/api/sites/${siteId}/outcome-fixtures/${fixture.id}${actionName === 'delete' ? '' : `/${actionName}`}`, {
        method: actionName === 'delete' ? 'DELETE' : 'POST',
      })
      const body = await response.json().catch(() => ({})) as { fixture?: OutcomeFixtureView; error?: string }
      if (!response.ok) {
        setMessage(body.error ?? 'Could not update this fixture.')
        return
      }
      if (actionName === 'delete') setFixtures((current) => current.filter((item) => item.id !== fixture.id))
      else if (body.fixture) setFixtures((current) => current.map((item) => item.id === body.fixture!.id ? body.fixture! : item))
      setMessage(actionName === 'dry-run' ? 'Dry run finished. Review its result before authorizing.' : actionName === 'authorize' ? 'Fixture authorized for Signup verification.' : actionName === 'revoke' ? 'Fixture authorization revoked.' : 'Fixture deleted.')
      router.refresh()
    } catch (error) {
      setMessage(siteActionMessage(error))
    } finally {
      setBusy(false)
    }
  }

  function edit(fixture: OutcomeFixtureView) {
    const mapping = fixture.fieldMapping as { fields?: Record<string, { value?: string }>; submit?: { value?: string } }
    const success = fixture.successCriterion as { type?: 'text' | 'url'; value?: string }
    setDraft({
      name: fixture.name,
      targetUrl: fixture.targetUrl,
      emailLabel: mapping.fields?.email?.value ?? 'Email',
      emailValue: '',
      passwordLabel: mapping.fields?.password?.value ?? '',
      passwordValue: '',
      submitName: mapping.submit?.value ?? 'Create account',
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
      <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3" aria-label="Signup setup steps">
        <li>1. Define a reversible test</li><li>2. Run it and inspect cleanup</li><li>3. Authorize this version</li>
      </ol>
      {fixtures.map((fixture) => {
        const dryRun = fixture.lastDryRunResult as { disposition?: string; reason?: string } | null
        const authorized = Boolean(fixture.authorizedAt && fixture.lastDryRunVersion === fixture.version)
        return (
          <article key={fixture.id} className="rounded-card border border-border/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{fixture.name}</h3>
                <p className="mt-1 break-all text-xs text-muted-foreground">{fixture.targetUrl}</p>
                <p className="mt-2 text-sm">{authorized ? 'Authorized' : dryRun?.disposition === 'SUCCEEDED' ? 'Dry run passed. Authorization required.' : dryRun ? `Dry run ${dryRun.disposition?.toLowerCase()}: ${dryRun.reason ?? 'No reason recorded'}` : 'Not exercised yet'}</p>
              </div>
              <span className="text-xs text-muted-foreground">Version {fixture.version}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void action(fixture, 'dry-run')}>Dry run</Button>
              {!authorized ? <Button size="sm" variant="brand" disabled={busy || dryRun?.disposition !== 'SUCCEEDED' || fixture.lastDryRunVersion !== fixture.version} onClick={() => void action(fixture, 'authorize')}>Authorize</Button> : <Button size="sm" variant="outline" disabled={busy} onClick={() => void action(fixture, 'revoke')}>Revoke</Button>}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => edit(fixture)}>Replace configuration</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void action(fixture, 'delete')}>Delete</Button>
            </div>
          </article>
        )
      })}

      {!open ? <Button variant="outline" onClick={() => { setDraft(EMPTY); setEditing(null); setOpen(true) }}>Add Safe Form fixture</Button> : (
        <form className="rounded-2xl border border-border/80 p-5" onSubmit={(event) => { event.preventDefault(); void save() }}>
          <h3 className="font-semibold">{editing ? 'Replace Safe Form configuration' : 'New Safe Form fixture'}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Use a dedicated synthetic account. FixFlags resets it, submits once, checks the result, and cleans it up on every run.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Fixture name"><Input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
            <Field label="Signup page URL"><Input required type="url" value={draft.targetUrl} onChange={(event) => setDraft({ ...draft, targetUrl: event.target.value })} /></Field>
            <Field label="Email field label"><Input required value={draft.emailLabel} onChange={(event) => setDraft({ ...draft, emailLabel: event.target.value })} /></Field>
            <Field label="Synthetic email"><Input required type="email" autoComplete="off" value={draft.emailValue} onChange={(event) => setDraft({ ...draft, emailValue: event.target.value })} /></Field>
            <Field label="Password field label"><Input value={draft.passwordLabel} onChange={(event) => setDraft({ ...draft, passwordLabel: event.target.value })} /></Field>
            <Field label="Synthetic password"><Input required={Boolean(draft.passwordLabel)} type="password" autoComplete="new-password" value={draft.passwordValue} onChange={(event) => setDraft({ ...draft, passwordValue: event.target.value })} /></Field>
            <Field label="Submit button name"><Input required value={draft.submitName} onChange={(event) => setDraft({ ...draft, submitName: event.target.value })} /></Field>
            <Field label="Success check"><select className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm" value={draft.successType} onChange={(event) => setDraft({ ...draft, successType: event.target.value as Draft['successType'] })}><option value="text">Visible text</option><option value="url">Exact URL</option></select></Field>
            <Field label={draft.successType === 'url' ? 'Success URL' : 'Success text'}><Input required type={draft.successType === 'url' ? 'url' : 'text'} value={draft.successValue} onChange={(event) => setDraft({ ...draft, successValue: event.target.value })} /></Field>
            <Field label="Reset hook URL"><Input required type="url" value={draft.resetUrl} onChange={(event) => setDraft({ ...draft, resetUrl: event.target.value })} /></Field>
            <Field label="Cleanup hook URL"><Input required type="url" value={draft.cleanupUrl} onChange={(event) => setDraft({ ...draft, cleanupUrl: event.target.value })} /></Field>
            <Field label="Hook bearer secret"><Input type="password" autoComplete="off" value={draft.hookSecret} onChange={(event) => setDraft({ ...draft, hookSecret: event.target.value })} /></Field>
          </div>
          <div className="mt-4 flex gap-2"><Button type="submit" variant="brand" disabled={busy}>{busy ? 'Saving…' : 'Save fixture'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button></div>
        </form>
      )}
      {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-medium">{label}<span className="mt-1 block">{children}</span></label>
}
