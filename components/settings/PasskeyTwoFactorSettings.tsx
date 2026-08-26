'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fingerprint, Loader2, KeyRound, Trash2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Callout } from '@/components/ui/callout'
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
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [enabled, setEnabled] = useState(twoFactorEnabled)
  const sec = AUTH.security

  const loadPasskeys = useCallback(async () => {
    const { data, error: listError } = await authClient.passkey.listUserPasskeys()
    if (listError) {
      setError(listError.message || sec.loadError)
      setPasskeys([])
      return
    }
    setPasskeys((data as PasskeyRow[]) ?? [])
  }, [sec.loadError])

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
      const { error: addError } = await authClient.passkey.addPasskey()
      if (addError) {
        setError(addError.message || sec.addError)
        return
      }
      toast.success(sec.addSuccess)
      await loadPasskeys()
      router.refresh()
    } catch {
      setError(sec.registrationFailed)
    } finally {
      setBusy(null)
    }
  }

  async function removePasskey(id: string) {
    const ok = await confirm({
      title: sec.removeTitle,
      description:
        enabled && passkeys.length <= 1
          ? sec.removeDescriptionLast
          : sec.removeDescription,
      confirmLabel: sec.removeLabel,
      destructive: true,
    })
    if (!ok) return
    setBusy(`delete-${id}`)
    setError(null)
    try {
      const { error: deleteError } = await authClient.passkey.deletePasskey({ id })
      if (deleteError) {
        setError(deleteError.message || sec.removeError)
        return
      }
      toast.success(sec.removeSuccess)
      await loadPasskeys()
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function enableTwoFactor(event: React.FormEvent) {
    event.preventDefault()
    if (passkeys.length < 1) {
      setError(sec.passkeyRequired)
      return
    }
    setBusy('enable')
    setError(null)
    try {
      const { data, error: enableError } = await authClient.twoFactor.enable({
        password: password || undefined,
      })
      if (enableError) {
        setError(enableError.message || sec.enableError)
        return
      }
      setEnabled(true)
      setPassword('')
      setBackupCodes(data?.backupCodes ?? null)
      toast.success(sec.enableSuccess)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function disableTwoFactor(event: React.FormEvent) {
    event.preventDefault()
    const ok = await confirm({
      title: sec.disableTitle,
      description: sec.disableDescription,
      confirmLabel: sec.disableLabel,
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
        setError(disableError.message || sec.disableError)
        return
      }
      setEnabled(false)
      setPassword('')
      setBackupCodes(null)
      toast.success(sec.disableSuccess)
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
        setError(genError.message || sec.backupCodesError)
        return
      }
      setBackupCodes(data?.backupCodes ?? null)
      setPassword('')
      toast.success(sec.backupCodesSuccess)
    } finally {
      setBusy(null)
    }
  }

  async function copyBackupCodes() {
    if (!backupCodes?.length) return
    await navigator.clipboard.writeText(backupCodes.join('\n'))
    toast.success(sec.backupCodesCopied)
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
          <h3 className="text-sm font-medium">{sec.passkeysTitle}</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">{sec.loadingPasskeys}</p>
          ) : passkeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">{sec.passkeysEmpty}</p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-card border border-border/60">
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
                      disabled={busy !== null}
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
          )}
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

      <div className="space-y-4 border-t border-border/60 pt-6">
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
              disabled={busy !== null || (!enabled && passkeys.length < 1)}
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
          <pre className="mb-3 overflow-x-auto rounded-md bg-background/60 p-3 font-mono text-xs">
            {backupCodes.join('\n')}
          </pre>
          <Button type="button" size="sm" variant="outline" onClick={() => void copyBackupCodes()}>
            {sec.copyBackupCodes}
          </Button>
        </Callout>
      )}
    </div>
  )
}
