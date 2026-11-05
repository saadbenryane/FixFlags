'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Fingerprint, Loader2, KeyRound, Trash2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { withClientDeadline } from '@/lib/api/client-request'
import { accountStatusReceipt as statusReceipt, requestAccountChange } from '@/lib/auth/client-account-request'
import { passkeyCreatedReceipt as passkeyReceipt, passkeyListReceipt as passkeyList } from '@/lib/auth/client-passkey-receipt'
import { AUTH } from '@/lib/marketing/copy-barrel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Callout } from '@/components/ui/callout'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

const backupCodeList = z.array(z.string().min(1).refine(code => Boolean(code.trim()))).min(1)
  .refine(codes => new Set(codes).size === codes.length)
const enrollmentReceipt = z.object({ method: z.literal('totp'), backupCodes: backupCodeList })
const backupCodesReceipt = z.object({ status: z.literal(true), backupCodes: backupCodeList })

function passkeyCreatedLabel(createdAt?: Date | string | null): string | null {
  if (!createdAt) return null
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function PasskeyTwoFactorSettings({
  twoFactorEnabled,
  hasPassword,
}: {
  twoFactorEnabled: boolean
  hasPassword: boolean
}) {
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirm()
  const [passkeys, setPasskeys] = useState<z.infer<typeof passkeyList> | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const listRequest = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const passkeyHeading = useRef<HTMLHeadingElement>(null)
  const focusAfterRetry = useRef(false)
  const [busy, setBusy] = useState<string | null>(null)
  const submitting = useRef(false)
  const commandOwner = useRef<AbortController | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [copyError, setCopyError] = useState(false)
  const codeBlock = useRef<HTMLPreElement>(null)
  const [enabled, setEnabled] = useState(twoFactorEnabled)
  const sec = AUTH.security

  const loadPasskeys = useCallback(async () => {
    if (!mounted.current) return
    listRequest.current?.abort()
    const owner = new AbortController()
    listRequest.current = owner
    const current = () => listRequest.current === owner && !owner.signal.aborted
    setLoading(true)
    try {
      const result = await withClientDeadline(signal => authClient.passkey.listUserPasskeys({ fetchOptions: { signal } }), owner.signal, 15_000)
      if (!current()) return
      if (result.error) { setListError(result.error.message || sec.loadError); return }
      const parsed = passkeyList.safeParse(result.data)
      if (!parsed.success) { setListError(sec.loadError); return }
      setPasskeys(parsed.data)
      setListError(null)
    } catch {
      if (current()) setListError(sec.loadError)
    } finally {
      if (current()) { setLoading(false); listRequest.current = null }
    }
  }, [sec.loadError])

  useEffect(() => {
    mounted.current = true
    commandOwner.current = new AbortController()
    void loadPasskeys()
    return () => {
      mounted.current = false
      listRequest.current?.abort(); listRequest.current = null
      commandOwner.current?.abort(); commandOwner.current = null
    }
  }, [loadPasskeys])
  useLayoutEffect(() => {
    if (loading || !focusAfterRetry.current) return
    focusAfterRetry.current = false
    if (!listError && document.activeElement === document.body) passkeyHeading.current?.focus()
  }, [loading, listError])

  function current(owner: AbortController) {
    return mounted.current && commandOwner.current === owner && !owner.signal.aborted
  }

  async function submit(action: string, fallback: string, operation: (owner: AbortController) => Promise<void>) {
    const owner = commandOwner.current
    if (!owner || !current(owner) || submitting.current) return
    submitting.current = true
    setBusy(action)
    setError(null)
    try {
      await operation(owner)
    } catch {
      if (current(owner)) setError(fallback)
    } finally {
      if (current(owner)) { submitting.current = false; setBusy(null) }
    }
  }

  async function addPasskey() {
    await submit('add', sec.registrationFailed, async owner => {
      // WebAuthn owns the native gesture's timing. Only ordinary HTTP commands
      // use the account request deadline.
      const result = await authClient.passkey.addPasskey()
      if (!current(owner)) return
      if (result.error || !passkeyReceipt.safeParse(result.data).success) {
        setError(result.error?.message || sec.addError)
        return
      }
      toast.success(sec.addSuccess)
      await loadPasskeys()
      if (current(owner)) router.refresh()
    })
  }

  async function removePasskey(id: string) {
    await submit(`delete-${id}`, sec.removeError, async owner => {
      const ok = await confirm({
        title: sec.removeTitle,
        description:
          enabled && (passkeys?.length ?? 0) <= 1
            ? sec.removeDescriptionLast
            : sec.removeDescription,
        confirmLabel: sec.removeLabel,
        destructive: true,
      })
      if (!ok || !current(owner)) return
      const result = await requestAccountChange(signal => authClient.passkey.deletePasskey({ id, fetchOptions: { signal } }), statusReceipt, sec.removeError, owner.signal)
      if (!current(owner)) return
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(sec.removeSuccess)
      await loadPasskeys()
      if (current(owner)) router.refresh()
    })
  }

  async function enableTwoFactor(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    if (!passkeys?.length || loading || listError) {
      setError(sec.passkeyRequired)
      return
    }
    await submit('enable', sec.enableError, async owner => {
      const result = await requestAccountChange(signal => authClient.twoFactor.enable({
        password: password || undefined,
        method: 'totp',
        fetchOptions: { signal },
      }), enrollmentReceipt, sec.enableError, owner.signal)
      if (!current(owner)) return
      if (!result.ok) {
        setError(result.error)
        return
      }
      setEnabled(true)
      setPassword('')
      setCopyError(false)
      setBackupCodes(result.data.backupCodes)
      toast.success(sec.enableSuccess)
      router.refresh()
    })
  }

  async function disableTwoFactor(event: React.FormEvent) {
    event.preventDefault()
    await submit('disable', sec.disableError, async owner => {
      const ok = await confirm({
        title: sec.disableTitle,
        description: sec.disableDescription,
        confirmLabel: sec.disableLabel,
        destructive: true,
      })
      if (!ok || !current(owner)) return
      setCopyError(false)
      setBackupCodes(null)
      const result = await requestAccountChange(signal => authClient.twoFactor.disable({
        password: password || undefined,
        fetchOptions: { signal },
      }), statusReceipt, sec.disableError, owner.signal)
      if (!current(owner)) return
      if (!result.ok) {
        setError(result.error)
        return
      }
      setEnabled(false)
      setPassword('')
      setBackupCodes(null)
      toast.success(sec.disableSuccess)
      router.refresh()
    })
  }

  async function regenerateBackupCodes() {
    await submit('backup', sec.backupCodesError, async owner => {
      // A submitted rotation may invalidate the displayed codes even if its
      // response is interrupted. Retire them until new codes are confirmed.
      setCopyError(false)
      setBackupCodes(null)
      const result = await requestAccountChange(signal => authClient.twoFactor.generateBackupCodes({
        password: password || undefined,
        fetchOptions: { signal },
      }), backupCodesReceipt, sec.backupCodesError, owner.signal)
      if (!current(owner)) return
      if (!result.ok) {
        setError(result.error)
        return
      }
      setBackupCodes(result.data.backupCodes)
      setPassword('')
      toast.success(sec.backupCodesSuccess)
    })
  }

  async function copyBackupCodes() {
    if (!backupCodes?.length) return
    await submit('copy', sec.backupCodesCopyError, async owner => {
      setCopyError(false)
      try {
        await withClientDeadline(() => navigator.clipboard.writeText(backupCodes.join('\n')), owner.signal)
      } catch {
        if (!current(owner)) return
        setCopyError(true)
        const block = codeBlock.current
        const selection = window.getSelection()
        if (block && selection) {
          block.focus()
          const range = document.createRange()
          range.selectNodeContents(block)
          selection.removeAllRanges()
          selection.addRange(range)
        }
        return
      }
      if (current(owner)) toast.success(sec.backupCodesCopied)
    })
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      {error && (
        <Callout variant="danger" title={sec.errorTitle}>
          {error}
        </Callout>
      )}

      <div className="space-y-4">
        <div className="space-y-1">
          <h3 ref={passkeyHeading} tabIndex={-1} className="text-sm font-medium">{sec.passkeysTitle}</h3>
          {listError ? <div role="alert" className="space-y-2 text-sm text-muted-foreground">
            <p>{listError}</p>
            <Button type="button" variant="outline" size="sm" disabled={busy !== null || loading} onClick={event => {
              if (listRequest.current) return
              focusAfterRetry.current = document.activeElement === event.currentTarget
              void loadPasskeys()
            }}>{sec.retryPasskeys}</Button>
          </div> : null}
          {loading ? <p role="status" className="text-sm text-muted-foreground">{sec.loadingPasskeys}</p> : null}
          {passkeys?.length === 0 && !loading && !listError ? (
            <p className="text-sm text-muted-foreground">{sec.passkeysEmpty}</p>
          ) : passkeys?.length ? (
            <ul className="space-y-2 overflow-hidden rounded-card bg-muted/20">
              {passkeys.map((passkey) => {
                const created = passkeyCreatedLabel(passkey.createdAt)
                const location = passkey.backedUp ? sec.synced : sec.device
                return (
                  <li
                    key={passkey.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{sec.passkeyItem}</p>
                      <p className="text-xs text-muted-foreground">
                        {created ? `${created} · ${location}` : location}
                        {passkey.deviceType ? ` · ${passkey.deviceType}` : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy !== null || loading || Boolean(listError)}
                      onClick={() => void removePasskey(passkey.id)}
                      aria-label={sec.deletePasskey}
                    >
                      {busy === `delete-${passkey.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>

        <Button
          type="button"
          onClick={() => void addPasskey()}
          disabled={busy !== null}
          loading={busy === 'add'}
          loadingLabel={sec.addPasskey}
        >
          {busy !== 'add' && <Fingerprint className="mr-2 h-4 w-4" />}
          {sec.addPasskey}
        </Button>
      </div>

      <div className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">{sec.enableTitle}</h3>
            <p className="text-sm text-muted-foreground">{sec.enableDescription}</p>
          </div>
          <Badge variant={enabled ? 'default' : 'secondary'}>
            {enabled ? sec.enabledBadge : sec.disabledBadge}
          </Badge>
        </div>

        <form
          onSubmit={enabled ? disableTwoFactor : enableTwoFactor}
          className="space-y-4"
        >
          {hasPassword ? (
            <div className="space-y-2">
              <label htmlFor="two-factor-password" className="text-sm font-medium">
                {sec.passwordLabel}
              </label>
              <Input
                id="two-factor-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required={hasPassword}
                disabled={busy !== null}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{sec.passwordlessHint}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant={enabled ? 'outline' : 'default'}
              disabled={busy !== null || (!enabled && (!passkeys?.length || loading || Boolean(listError)))}
              loading={busy === 'enable' || busy === 'disable'}
              loadingLabel={enabled ? sec.disableCta : sec.enableCta}
            >
              {busy !== 'enable' && busy !== 'disable' && <KeyRound className="mr-2 h-4 w-4" />}
              {enabled ? sec.disableCta : sec.enableCta}
            </Button>
            {enabled && (
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void regenerateBackupCodes()}
                loading={busy === 'backup'}
                loadingLabel={sec.regenerateBackupCodes}
              >
                {sec.regenerateBackupCodes}
              </Button>
            )}
          </div>
        </form>
      </div>

      {backupCodes && backupCodes.length > 0 && (
        <Callout variant="warning" title={sec.backupCodesTitle}>
          <p className="mb-3 text-sm">{sec.backupCodesBody}</p>
          {copyError ? <p role="alert" className="mb-3 text-sm">{sec.backupCodesCopyError}</p> : null}
          <pre ref={codeBlock} tabIndex={-1} className="mb-3 overflow-x-auto rounded-md bg-background/60 p-3 font-mono text-xs">
            {backupCodes.join('\n')}
          </pre>
          <Button type="button" size="sm" variant="outline" disabled={busy !== null} loading={busy === 'copy'} onClick={() => void copyBackupCodes()}>
            {sec.copyBackupCodes}
          </Button>
        </Callout>
      )}
    </div>
  )
}
