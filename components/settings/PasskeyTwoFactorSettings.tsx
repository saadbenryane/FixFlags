'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fingerprint, Loader2, KeyRound, Trash2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Callout } from '@/components/ui/callout'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

type PasskeyRow = {
  id: string
  name?: string | null
  aaguid?: string | null
  createdAt?: Date | string | null
  deviceType?: string | null
  backedUp?: boolean
}

function passkeyLabel(passkey: PasskeyRow): string {
  return passkey.name?.trim() || 'Passkey'
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
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [newPasskeyName, setNewPasskeyName] = useState('')
  const [enabled, setEnabled] = useState(twoFactorEnabled)

  const loadPasskeys = useCallback(async () => {
    const { data, error: listError } = await authClient.passkey.listUserPasskeys()
    if (listError) {
      setError(listError.message || 'Could not load passkeys')
      setPasskeys([])
      return
    }
    setPasskeys((data as PasskeyRow[]) ?? [])
  }, [])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        await loadPasskeys()
      } finally {
        setLoading(false)
      }
    })()
  }, [loadPasskeys])

  async function addPasskey() {
    setBusy('add')
    setError(null)
    try {
      const { error: addError } = await authClient.passkey.addPasskey({
        name: newPasskeyName.trim() || undefined,
      })
      if (addError) {
        setError(addError.message || 'Could not add passkey')
        return
      }
      setNewPasskeyName('')
      toast.success('Passkey added')
      await loadPasskeys()
      router.refresh()
    } catch {
      setError('Passkey registration was cancelled or failed')
    } finally {
      setBusy(null)
    }
  }

  async function removePasskey(id: string) {
    const ok = await confirm({
      title: 'Remove this passkey?',
      description:
        enabled && passkeys.length <= 1
          ? 'This is your last passkey. Remove it only if you still have backup codes.'
          : 'You will not be able to use this passkey to sign in.',
      confirmLabel: 'Remove passkey',
      destructive: true,
    })
    if (!ok) return
    setBusy(`delete-${id}`)
    setError(null)
    try {
      const { error: deleteError } = await authClient.passkey.deletePasskey({ id })
      if (deleteError) {
        setError(deleteError.message || 'Could not remove passkey')
        return
      }
      toast.success('Passkey removed')
      await loadPasskeys()
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function enableTwoFactor(event: React.FormEvent) {
    event.preventDefault()
    if (passkeys.length < 1) {
      setError('Add a passkey before enabling two-factor authentication')
      return
    }
    setBusy('enable')
    setError(null)
    try {
      const { data, error: enableError } = await authClient.twoFactor.enable({
        password: password || undefined,
      })
      if (enableError) {
        setError(enableError.message || 'Could not enable two-factor authentication')
        return
      }
      setEnabled(true)
      setPassword('')
      setBackupCodes(data?.backupCodes ?? null)
      toast.success('Passkey two-factor authentication enabled')
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function disableTwoFactor(event: React.FormEvent) {
    event.preventDefault()
    const ok = await confirm({
      title: 'Disable two-factor authentication?',
      description: 'Password-only sign-in will work again without a passkey challenge.',
      confirmLabel: 'Disable 2FA',
      destructive: true,
    })
    if (!ok) return
    setBusy('disable')
    setError(null)
    try {
      const { error: disableError } = await authClient.twoFactor.disable({
        password: password || undefined,
      })
      if (disableError) {
        setError(disableError.message || 'Could not disable two-factor authentication')
        return
      }
      setEnabled(false)
      setPassword('')
      setBackupCodes(null)
      toast.success('Two-factor authentication disabled')
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function regenerateBackupCodes() {
    setBusy('backup')
    setError(null)
    try {
      const { data, error: genError } = await authClient.twoFactor.generateBackupCodes({
        password: password || undefined,
      })
      if (genError) {
        setError(genError.message || 'Could not generate backup codes')
        return
      }
      setBackupCodes(data?.backupCodes ?? null)
      setPassword('')
      toast.success('New backup codes generated')
    } finally {
      setBusy(null)
    }
  }

  async function copyBackupCodes() {
    if (!backupCodes?.length) return
    await navigator.clipboard.writeText(backupCodes.join('\n'))
    toast.success(AUTH.security.backupCodesCopied)
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      {error && (
        <Callout variant="danger" title="Security update failed">
          {error}
        </Callout>
      )}

      <Card className="border-0 p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">{AUTH.security.title}</h2>
            <p className="text-sm text-muted-foreground">{AUTH.security.description}</p>
          </div>
          <Badge variant={enabled ? 'default' : 'secondary'}>
            {enabled ? AUTH.security.enabledBadge : AUTH.security.disabledBadge}
          </Badge>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">{AUTH.security.passkeysTitle}</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading passkeys…</p>
            ) : passkeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">{AUTH.security.passkeysEmpty}</p>
            ) : (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-card border border-border/60">
                {passkeys.map((passkey) => (
                  <li
                    key={passkey.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{passkeyLabel(passkey)}</p>
                      <p className="text-xs text-muted-foreground">
                        {passkey.backedUp ? 'Synced' : 'Device'}
                        {passkey.deviceType ? ` · ${passkey.deviceType}` : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void removePasskey(passkey.id)}
                      aria-label={AUTH.security.deletePasskey}
                    >
                      {busy === `delete-${passkey.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={newPasskeyName}
              onChange={(event) => setNewPasskeyName(event.target.value)}
              placeholder="Passkey name (optional)"
              aria-label="Passkey name"
              disabled={busy !== null}
            />
            <Button type="button" onClick={() => void addPasskey()} disabled={busy !== null}>
              {busy === 'add' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Fingerprint className="mr-2 h-4 w-4" />
              )}
              {AUTH.security.addPasskey}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-0 p-5 shadow-card">
        <form
          onSubmit={enabled ? disableTwoFactor : enableTwoFactor}
          className="space-y-4"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-medium">{AUTH.security.enableTitle}</h3>
            <p className="text-sm text-muted-foreground">{AUTH.security.enableDescription}</p>
          </div>
          {hasPassword ? (
            <div className="space-y-2">
              <label htmlFor="two-factor-password" className="text-sm font-medium">
                {AUTH.security.passwordLabel}
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
            <p className="text-sm text-muted-foreground">{AUTH.security.passwordlessHint}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant={enabled ? 'outline' : 'default'}
              disabled={busy !== null || (!enabled && passkeys.length < 1)}
            >
              {(busy === 'enable' || busy === 'disable') && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <KeyRound className="mr-2 h-4 w-4" />
              {enabled ? AUTH.security.disableCta : AUTH.security.enableCta}
            </Button>
            {enabled && (
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void regenerateBackupCodes()}
              >
                {busy === 'backup' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {AUTH.security.regenerateBackupCodes}
              </Button>
            )}
          </div>
        </form>
      </Card>

      {backupCodes && backupCodes.length > 0 && (
        <Callout variant="warning" title={AUTH.security.backupCodesTitle}>
          <p className="mb-3 text-sm">{AUTH.security.backupCodesBody}</p>
          <pre className="mb-3 overflow-x-auto rounded-md bg-background/60 p-3 font-mono text-xs">
            {backupCodes.join('\n')}
          </pre>
          <Button type="button" size="sm" variant="outline" onClick={() => void copyBackupCodes()}>
            {AUTH.security.copyBackupCodes}
          </Button>
        </Callout>
      )}
    </div>
  )
}
