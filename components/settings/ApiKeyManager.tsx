'use client'

import { InteractiveInput, InteractiveSelect } from '@/components/ui/interactive-controls'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, Copy, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { API_KEY_COPY } from '@/lib/marketing/copy/terminology'
import { Input } from '@/components/ui/input'
import { ApiKeyAccessError, ApiKeyCreationUnconfirmed, createApiKey, listApiKeys, revokeApiKey, type ApiKeySummary, type CreatedApiKey } from '@/lib/api/api-key-client'
import { withClientDeadline } from '@/lib/api/client-request'
import type { ApiKeyClient } from '@/lib/mcp/builders'
import {
  DEFAULT_DEVELOPER_KEY_EXPIRY_DAYS,
  DEFAULT_DEVELOPER_KEY_SCOPE_PRESET,
  DEVELOPER_KEY_SCOPE_PRESETS,
  DEVELOPER_KEY_EXPIRY_DAYS,
  developerKeyScopeLabel,
  type DeveloperKeyExpiryDays,
  type DeveloperKeyScopePreset,
} from '@/lib/mcp/developer-key-policy'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { useMe } from '@/hooks/useMe'
import { AUTH } from '@/lib/marketing/copy/auth'
import Link from 'next/link'
import type { Route } from 'next'

type ManagerProps = { ownerId: string; client?: ApiKeyClient; headingAs?: 'h2' | 'h3'; returnPath?: string }
type FocusContinuation = { owner: AbortController; origin: HTMLElement; target: 'key' | 'list'; waitForList: boolean }
function AccountRecovery({ reason, returnPath }: { reason: 'signed_out' | 'account_changed'; returnPath: string }) {
  return <div className="space-y-3"><p role="alert" className="text-sm text-muted-foreground">{reason === 'signed_out' ? API_KEY_COPY.accountUnavailable : API_KEY_COPY.accountChanged}</p>
    {reason === 'signed_out' ? <Button asChild variant="outline"><Link href={`/sign-in?next=${encodeURIComponent(returnPath)}` as Route}>{AUTH.signIn.cta}</Link></Button>
      : <Button type="button" variant="outline" onClick={() => window.location.reload()}>{API_KEY_COPY.refreshAccount}</Button>}
  </div>
}

export function ApiKeyManager({ returnPath = '/settings/api-keys', ...props }: ManagerProps) {
  const { user, isLoading } = useMe({ load: false })
  if (user?.id !== props.ownerId) return isLoading && !user
    ? <p role="status" className="text-sm text-muted-foreground">{AUTH.postLogin.preparing}</p>
    : <AccountRecovery reason={user ? 'account_changed' : 'signed_out'} returnPath={returnPath} />
  return <ApiKeyManagerContent key={props.ownerId} {...props} returnPath={returnPath} />
}

function ApiKeyManagerContent({ ownerId, client = 'other', headingAs: KeysHeading = 'h2', returnPath }: ManagerProps & { returnPath: string }) {
  const [accessError, setAccessError] = useState<'signed_out' | 'account_changed' | null>(null)
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null)
  const [name, setName] = useState('')
  const [expiresInDays, setExpiresInDays] = useState<DeveloperKeyExpiryDays>(DEFAULT_DEVELOPER_KEY_EXPIRY_DAYS)
  const [scopePreset, setScopePreset] = useState<DeveloperKeyScopePreset>(DEFAULT_DEVELOPER_KEY_SCOPE_PRESET)
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)
  const busy = pending !== null
  const submitting = pending === 'create'
  const commandBusy = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  const listRequest = useRef<AbortController | null>(null)
  const [listError, setListError] = useState('')
  const [creationUncertain, setCreationUncertain] = useState(false)
  const listHeading = useRef<HTMLHeadingElement>(null)
  const focusContinuation = useRef<FocusContinuation | null>(null)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')
  const revealedKey = useRef<HTMLInputElement>(null)
  const retireAccess = useCallback((error: ApiKeyAccessError) => {
    lifetime.current?.abort(); lifetime.current = null
    listRequest.current?.abort(); listRequest.current = null
    setKeys(null); setCreated(null); setCopied(false); setAccessError(error.reason)
  }, [])

  const loadKeys = useCallback(async () => {
    if (!lifetime.current || lifetime.current.signal.aborted) return
    listRequest.current?.abort()
    const owner = new AbortController()
    listRequest.current = owner
    const current = () => listRequest.current === owner && !owner.signal.aborted
    setLoading(true)
    try {
      const result = await listApiKeys(owner.signal, ownerId)
      if (current()) { setKeys(result); setListError(''); setCreationUncertain(false) }
    } catch (error) {
      if (current()) {
        if (error instanceof ApiKeyAccessError) retireAccess(error)
        else setListError(API_KEY_COPY.listFailed)
      }
    }
    finally { if (current()) { setLoading(false); listRequest.current = null } }
  }, [ownerId, retireAccess])

  useEffect(() => {
    const owner = new AbortController()
    lifetime.current = owner
    void loadKeys()
    return () => {
      owner.abort()
      if (lifetime.current === owner) lifetime.current = null
      listRequest.current?.abort(); listRequest.current = null
    }
  }, [loadKeys])
  useLayoutEffect(() => {
    const continuation = focusContinuation.current
    if (!continuation || busy || continuation.waitForList && loading) return
    focusContinuation.current = null
    if (!current(continuation.owner) || continuation.waitForList && listError ||
      document.activeElement !== document.body && document.activeElement !== continuation.origin) return
    const target = continuation.target === 'key' ? revealedKey.current : listHeading.current
    target?.focus()
  }, [busy, loading, listError, created, keys])
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timer)
  }, [copied, created?.id])

  function current(owner: AbortController) { return lifetime.current === owner && !owner.signal.aborted }
  function continueAt(owner: AbortController, origin: HTMLElement | null, target: FocusContinuation['target'], waitForList = false): FocusContinuation | null {
    return origin && document.activeElement === origin ? { owner, origin, target, waitForList } : null
  }
  async function run(kind: string, fallback: string, operation: (owner: AbortController) => Promise<void>) {
    const owner = lifetime.current
    if (!owner || !current(owner) || commandBusy.current) return
    focusContinuation.current = null
    commandBusy.current = true
    setPending(kind); setMessage('')
    try { await operation(owner) }
    catch (error) {
      if (current(owner)) {
        if (error instanceof ApiKeyAccessError) { retireAccess(error); return }
        setMessage(error instanceof Error ? error.message : fallback)
        if (kind === 'create' && error instanceof ApiKeyCreationUnconfirmed) setCreationUncertain(true)
      }
    }
    finally { if (current(owner)) { commandBusy.current = false; setPending(null) } }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || creationUncertain) return
    const origin = document.activeElement instanceof HTMLElement && event.currentTarget.contains(document.activeElement) ? document.activeElement : null
    await run('create', 'Could not create a key.', async owner => {
      const continuation = continueAt(owner, origin, 'key')
      const next = await createApiKey({
        name,
        client,
        scopePreset,
        expiresInDays,
      }, owner.signal, ownerId)
      if (!current(owner)) return
      focusContinuation.current = continuation
      setCreated(next); setCopied(false)
      setMessage('Key created. Copy it now. FixFlags will not show it again.')
      // The confirmed secret is already available. Inventory availability is a
      // separate read and cannot turn its creation into a reported failure.
      void loadKeys()
    })
  }

  async function handleCopy() {
    if (!created) return
    await run('copy', API_KEY_COPY.copyUnconfirmed, async owner => {
      try {
        await withClientDeadline(() => navigator.clipboard.writeText(created.key), owner.signal)
        if (current(owner)) setCopied(true)
      } catch {
        if (!current(owner)) return
        setMessage(API_KEY_COPY.copyUnconfirmed)
        revealedKey.current?.focus(); revealedKey.current?.select()
      }
    })
  }

  async function handleRevoke(id: string, trigger: HTMLButtonElement) {
    await run(`revoke:${id}`, API_KEY_COPY.revokeFailed, async owner => {
      const continuation = continueAt(owner, trigger, 'list')
      await revokeApiKey(id, owner.signal, ownerId)
      if (!current(owner)) return
      focusContinuation.current = continuation
      setKeys(previous => previous?.filter(key => key.id !== id) ?? null)
      if (created?.id === id) { setCreated(null); setCopied(false) }
      setMessage('Key revoked.')
      void loadKeys()
    })
  }

  if (accessError) return <AccountRecovery reason={accessError} returnPath={returnPath} />

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
        <label htmlFor="api-key-name" className="space-y-2 text-sm font-medium">
          Key name
          <Input
            id="api-key-name"
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />
        </label>
        <label htmlFor="api-key-expiry" className="space-y-2 text-sm font-medium">
          Expires after
          <InteractiveSelect
            id="api-key-expiry"
            value={expiresInDays}
            disabled={busy}
            onChange={(event) => setExpiresInDays(Number(event.target.value) as DeveloperKeyExpiryDays)}
            className="flex h-11 w-full rounded-[var(--radius-control)] border border-border bg-background px-3 text-sm max-sm:text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {DEVELOPER_KEY_EXPIRY_DAYS.map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </InteractiveSelect>
        </label>
        <label htmlFor="api-key-access" className="space-y-2 text-sm font-medium md:col-span-2">
          {API_KEY_COPY.accessLabel}
          <InteractiveSelect id="api-key-access" value={scopePreset}
            disabled={busy}
            onChange={event => setScopePreset(event.currentTarget.value as DeveloperKeyScopePreset)}
            className="flex h-11 w-full rounded-[var(--radius-control)] border border-border bg-background px-3 text-sm max-sm:text-base">
            {DEVELOPER_KEY_SCOPE_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </InteractiveSelect>
          <span className="block text-sm font-normal text-muted-foreground">{DEVELOPER_KEY_SCOPE_PRESETS.find(preset => preset.id === scopePreset)?.description}</span>
        </label>
        <Button type="submit" disabled={busy || creationUncertain || !name.trim()} className="min-h-11 md:col-span-2 md:w-fit">
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <KeyRound className="mr-2 h-4 w-4" aria-hidden />
          )}
          Create key
        </Button>
      </form>

      {created ? (
        <div className="rounded-card border border-brand/30 bg-brand-muted p-4">
          <p className="text-sm font-medium">Copy this key now</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <InteractiveInput
              ref={revealedKey}
              readOnly
              value={created.key}
              aria-label="New API key"
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 overflow-x-auto rounded-[var(--radius-control)] border border-border bg-background px-3 font-mono text-sm max-sm:text-base"
            />
            <Button type="button" variant="outline" disabled={busy} loading={pending === 'copy'} onClick={() => void handleCopy()} className="min-h-11">
              {copied ? <Check className="mr-2 h-4 w-4" aria-hidden /> : <Copy className="mr-2 h-4 w-4" aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            {listError && !keys?.some(key => key.id === created.id) ? <Button type="button" variant="ghost" disabled={busy}
              loading={pending === `revoke:${created.id}`} onClick={event => void handleRevoke(created.id, event.currentTarget)}>Revoke</Button> : null}
          </div>
        </div>
      ) : null}

      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {message}
      </p>

      <div>
        <KeysHeading ref={listHeading} tabIndex={-1} className="text-base font-semibold">Active keys</KeysHeading>
        {listError || creationUncertain ? <div role={listError ? 'alert' : undefined} className="mt-3 space-y-2 text-sm text-muted-foreground">{listError ? <p>{listError}</p> : null}
          <Button type="button" variant="outline" size="sm" disabled={loading || busy} onClick={event => {
            if (listRequest.current || !lifetime.current) return
            focusContinuation.current = continueAt(lifetime.current, event.currentTarget, 'list', true)
            void loadKeys()
          }}>{API_KEY_COPY.retryList}</Button>
        </div> : null}
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading keys…</p>
        ) : null}
        {!loading && !listError && !creationUncertain && keys?.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No active keys.</p>
        ) : null}
        {keys?.length ? (
          <ul className="mt-3 space-y-2 rounded-card bg-muted/20">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{key.name}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{key.prefix}…{key.lastFour}</span><span>{developerKeyScopeLabel(key.scopes)}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{key.lastUsed ? `Last used ${formatEvidenceTimestamp(key.lastUsed)}` : 'Never used'}</span>
                    <span>{key.expiresAt ? `Expires ${formatEvidenceTimestamp(key.expiresAt)}` : 'Legacy key with no expiry'}</span>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  loading={pending === `revoke:${key.id}`}
                  onClick={event => void handleRevoke(key.id, event.currentTarget)}
                  className="min-h-11 sm:self-center"
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Revoke
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
