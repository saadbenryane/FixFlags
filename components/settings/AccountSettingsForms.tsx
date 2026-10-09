'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Callout } from '@/components/ui/callout'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { Field } from '@/components/ui/form-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function AccountSettingsForms({
  initialName,
  email,
  emailVerified,
  planName,
  isPaid,
}: {
  initialName: string
  email: string
  emailVerified: boolean
  planName: string
  isPaid: boolean
}) {
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirm()
  const [name, setName] = useState(initialName)
  const [savedName, setSavedName] = useState(initialName)
  const [newEmail, setNewEmail] = useState(email)
  const [savedEmail, setSavedEmail] = useState(email)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ac = AUTH.settings.account

  const nameDirty = name.trim() !== savedName.trim()
  const emailDirty = newEmail.trim() !== savedEmail
  const dirty = nameDirty || emailDirty

  useEffect(() => {
    setName(initialName)
    setSavedName(initialName)
  }, [initialName])

  useEffect(() => {
    setNewEmail(email)
    setSavedEmail(email)
  }, [email])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useEffect(() => {
    if (!dirty) return

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return
      }
      let next: URL
      try {
        next = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (next.origin !== window.location.origin) return
      if (
        next.pathname === window.location.pathname &&
        next.search === window.location.search &&
        next.hash === window.location.hash
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void (async () => {
        const ok = await confirm({
          title: ac.unsavedTitle,
          description: ac.unsavedDescription,
          confirmLabel: ac.unsavedLeave,
          cancelLabel: ac.unsavedStay,
        })
        if (!ok) return
        router.push(`${next.pathname}${next.search}${next.hash}` as Route)
      })()
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [dirty, confirm, router, ac.unsavedTitle, ac.unsavedDescription, ac.unsavedLeave, ac.unsavedStay])

  async function run(operation: () => Promise<{ error?: { message?: string } | null }>) {
    const result = await operation()
    if (result.error) {
      setError(result.error.message || ac.errorFallback)
      return false
    }
    return true
  }

  async function saveChanges(event: React.FormEvent) {
    event.preventDefault()
    if (!dirty) return

    setBusy('save')
    setError(null)
    try {
      if (nameDirty) {
        if (!(await run(() => authClient.updateUser({ name: name.trim() })))) return
        setSavedName(name.trim())
      }
      if (emailDirty) {
        if (
          !(await run(() =>
            authClient.changeEmail({
              newEmail: newEmail.trim(),
              callbackURL: '/settings',
            })
          ))
        ) {
          return
        }
        setSavedEmail(newEmail.trim())
      }
      if (emailDirty) {
        toast.success(ac.changeEmailSuccess)
      } else {
        toast.success(ac.saveSuccess)
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function sendVerification() {
    setBusy('verify')
    setError(null)
    try {
      if (
        await run(() =>
          authClient.sendVerificationEmail({
            email,
            callbackURL: '/settings',
          })
        )
      ) {
        toast.success(ac.verifySuccess)
      }
    } finally {
      setBusy(null)
    }
  }

  const planHref = isPaid ? '/billing' : '/pricing'
  const planCta = isPaid ? ac.managePlanCta : ac.upgradeCta
  const emailStatus = useMemo(
    () => (emailVerified ? ac.verified : ac.notVerified),
    [emailVerified, ac.verified, ac.notVerified]
  )

  return (
    <div className="space-y-6">
      {confirmDialog}
      {error && (
        <Callout variant="danger" title={ac.errorTitle}>
          {error}
        </Callout>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{ac.planLabel}</span>
        <div className="flex items-center gap-3">
          <span className="font-medium">{planName}</span>
          <Button asChild variant={isPaid ? 'outline' : 'default'} size="sm">
            <Link href={planHref}>{planCta}</Link>
          </Button>
        </div>
      </div>

      <form onSubmit={saveChanges} className="space-y-5">
        <Field id="account-name" label={ac.nameLabel}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        <Field
          id="account-email"
          label={
            <span className="inline-flex items-center gap-2">
              {ac.emailLabel}
              <Badge variant={emailVerified ? 'default' : 'secondary'}>{emailStatus}</Badge>
            </span>
          }
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              name="email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
            />
          )}
        </Field>

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={busy !== null || !dirty}
            loading={busy === 'save'}
            loadingLabel={ac.saving}
          >
            {ac.saveCta}
          </Button>
          {!emailVerified && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void sendVerification()}
              disabled={busy !== null}
              loading={busy === 'verify'}
              loadingLabel={ac.verifySending}
            >
              {ac.verifyCta}
            </Button>
          )}
        </div>
      </form>

    </div>
  )
}

export function PasswordSettings({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ac = AUTH.settings.account

  async function changePassword(event: React.FormEvent) {
    event.preventDefault()
    if (!currentPassword || newPassword.length < 8) {
      setError(ac.passwordIncomplete)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
      if (result.error) {
        setError(result.error.message || ac.errorFallback)
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setOpen(false)
      toast.success(ac.changePasswordSuccess)
    } finally {
      setBusy(false)
    }
  }

  if (!hasPassword) {
    return <div id="password" className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-medium">Password</h3><p className="mt-1 text-xs text-muted-foreground">No password is set for this account.</p></div><Button size="sm" variant="outline" asChild><Link href="/forgot-password">Set password</Link></Button></div>
  }

  return <section id="password" className="space-y-4">
    {error ? <Callout variant="danger" title={ac.errorTitle}>{error}</Callout> : null}
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-medium">Password</h3><p className="mt-1 text-xs text-muted-foreground">A password is set for this account.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>{open ? 'Cancel' : 'Change password'}</Button></div>
    {open ? <form className="space-y-4" onSubmit={changePassword}>
      <Field id="current-password" label={ac.currentPasswordLabel}>{(fieldProps) => <Input {...fieldProps} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />}</Field>
      <Field id="new-password" label={ac.newPasswordLabel}>{(fieldProps) => <Input {...fieldProps} type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />}</Field>
      <Button type="submit" disabled={busy} loading={busy} loadingLabel={ac.saving}>Change password</Button>
    </form> : null}
  </section>
}

export function AccountDangerZone() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ac = AUTH.settings.account

  async function deleteAccount() {
    setBusy(true)
    setError(null)
    try {
      const result = await authClient.deleteUser({ password: password || undefined, callbackURL: '/' })
      if (result.error) {
        setError(result.error.message || ac.errorFallback)
        return
      }
      setOpen(false)
      setPassword('')
      toast.success(ac.deleteSuccess)
    } finally {
      setBusy(false)
    }
  }

  return <>
    {error ? <Callout variant="danger" title={ac.errorTitle}>{error}</Callout> : null}
    <Button type="button" variant="destructive" disabled={busy} onClick={() => setOpen(true)}>{ac.deleteCta}</Button>
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setPassword('') }}>
      <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{ac.deleteConfirmTitle}</DialogTitle><DialogDescription>{ac.deleteConfirmDescription}</DialogDescription></DialogHeader>
        <Field id="delete-password" label={ac.deletePasswordLabel}>{(fieldProps) => <Input {...fieldProps} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />}</Field>
        <DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>{ac.deleteCancel}</Button><Button type="button" variant="destructive" disabled={busy} loading={busy} loadingLabel={ac.deleteConfirming} onClick={() => void deleteAccount()}>{ac.deleteConfirmLabel}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
