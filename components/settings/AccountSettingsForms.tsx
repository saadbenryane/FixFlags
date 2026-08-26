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
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ac = AUTH.settings.account

  const nameDirty = name.trim() !== savedName.trim()
  const emailDirty = newEmail.trim() !== savedEmail
  const passwordDirty = currentPassword.length > 0 || newPassword.length > 0
  const dirty = nameDirty || emailDirty || passwordDirty

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
    if (passwordDirty && (currentPassword.length === 0 || newPassword.length < 8)) {
      setError(ac.passwordIncomplete)
      return
    }
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
      if (passwordDirty) {
        if (
          !(await run(() =>
            authClient.changePassword({
              currentPassword,
              newPassword,
              revokeOtherSessions: true,
            })
          ))
        ) {
          return
        }
        setCurrentPassword('')
        setNewPassword('')
      }
      if (emailDirty) {
        toast.success(ac.changeEmailSuccess)
      } else if (passwordDirty) {
        toast.success(ac.changePasswordSuccess)
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

  async function confirmDeleteAccount() {
    setBusy('delete')
    setError(null)
    try {
      if (
        await run(() =>
          authClient.deleteUser({
            password: deletePassword || undefined,
            callbackURL: '/',
          })
        )
      ) {
        setDeleteOpen(false)
        setDeletePassword('')
        toast.success(ac.deleteSuccess)
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

        <div className="space-y-4">
          <h2 className="text-sm font-medium">{ac.passwordTitle}</h2>
          <Field id="current-password" label={ac.currentPasswordLabel}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            )}
          </Field>
          <Field id="new-password" label={ac.newPasswordLabel}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            )}
          </Field>
        </div>

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

      <div className="border-t border-border/60 pt-5">
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={busy !== null}
          onClick={() => setDeleteOpen(true)}
        >
          {ac.deleteCta}
        </Button>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeletePassword('')
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{ac.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>{ac.deleteConfirmDescription}</DialogDescription>
          </DialogHeader>
          <Field id="delete-password" label={ac.deletePasswordLabel}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            )}
          </Field>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              {ac.deleteCancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy !== null}
              loading={busy === 'delete'}
              loadingLabel={ac.deleteConfirming}
              onClick={() => void confirmDeleteAccount()}
            >
              {ac.deleteConfirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
