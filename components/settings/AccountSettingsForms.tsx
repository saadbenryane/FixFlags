'use client'

import { useRef, useState } from 'react'
import { z } from 'zod'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'
import { accountStatusReceipt as accountUpdateReceipt, requestAccountChange, type AccountClientRequest } from '@/lib/auth/client-account-request'
import { AUTH } from '@/lib/marketing/copy-barrel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Callout } from '@/components/ui/callout'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { useSettingsDraft } from '@/hooks/useSettingsDraft'
import { Field } from '@/components/ui/form-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const passwordUpdateReceipt = z.object({ user: z.object({ id: z.string().min(1) }), token: z.string().min(1).nullable() })
const deletionEmailReceipt = z.object({ success: z.literal(true), message: z.literal('Verification email sent') })

async function accountRequest(operation: AccountClientRequest, receipt: z.ZodType): Promise<string | null> {
  const result = await requestAccountChange(operation, receipt, AUTH.settings.account.errorFallback)
  return result.ok ? null : result.error
}

export function AccountSettingsForms({
  ownerId,
  initialName,
  email,
  emailVerified,
  planName,
}: {
  ownerId: string
  initialName: string
  email: string
  emailVerified: boolean
  planName: string
}) {
  const draft = useSettingsDraft(ownerId, 'profile', { name: initialName, email })
  const { name, email: newEmail } = draft.values
  const [busy, setBusy] = useState<string | null>(null)
  const submitting = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const ac = AUTH.settings.account

  const nameDirty = name.trim() !== draft.saved.name.trim()
  const emailDirty = newEmail.trim() !== draft.saved.email
  const dirty = nameDirty || emailDirty
  const matchesCurrentEmail = newEmail.trim() === email
  const emailIsVerified = emailVerified && matchesCurrentEmail

  const confirmDialog = useUnsavedChanges(draft.dirty, draft.discard)

  async function run(operation: AccountClientRequest) {
    const failure = await accountRequest(operation, accountUpdateReceipt)
    if (failure) {
      setError(failure)
      return false
    }
    return true
  }

  async function saveChanges(event: React.FormEvent) {
    event.preventDefault()
    if (!dirty || submitting.current) return
    submitting.current = true
    const submitted = draft.snapshot()

    setBusy('save')
    setError(null)
    try {
      if (nameDirty) {
        const confirmedName = submitted.values.name.trim()
        if (!(await run(signal => authClient.updateUser({ name: confirmedName, fetchOptions: { signal } })))) return
        draft.acknowledge(submitted, { name: confirmedName })
      }
      if (emailDirty) {
        if (
          !(await run(signal =>
            authClient.changeEmail({
              newEmail: submitted.values.email.trim(),
              callbackURL: '/settings',
              fetchOptions: { signal },
            })
          ))
        ) {
          return
        }
        draft.acknowledge(submitted, { email: submitted.values.email.trim() })
      }
      if (emailDirty) {
        toast.success(ac.changeEmailSuccess)
      } else {
        toast.success(ac.saveSuccess)
      }
    } catch {
      setError(ac.errorFallback)
    } finally {
      submitting.current = false
      setBusy(null)
    }
  }

  async function sendVerification() {
    if (submitting.current || !matchesCurrentEmail) return
    submitting.current = true
    setBusy('verify')
    setError(null)
    try {
      if (
        await run(signal =>
          authClient.sendVerificationEmail({
            email,
            callbackURL: '/settings',
            fetchOptions: { signal },
          })
        )
      ) {
        toast.success(ac.verifySuccess)
      }
    } catch {
      setError(ac.errorFallback)
    } finally {
      submitting.current = false
      setBusy(null)
    }
  }

  // Billing owns the plan, including the paid-plan waitlist during open beta.
  const planHref = '/billing'
  const planCta = ac.managePlanCta
  const emailStatus = emailIsVerified ? ac.verified : ac.notVerified

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
          <Button asChild variant="outline" size="sm">
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
              disabled={busy !== null}
              onChange={(event) => draft.change({ name: event.target.value })}
            />
          )}
        </Field>

        <Field
          id="account-email"
          label={
            <span className="inline-flex items-center gap-2">
              {ac.emailLabel}
              <Badge variant={emailIsVerified ? 'default' : 'secondary'}>{emailStatus}</Badge>
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
              disabled={busy !== null}
              onChange={(event) => draft.change({ email: event.target.value })}
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
          {draft.dirty ? <Button type="button" variant="ghost" disabled={busy !== null} onClick={draft.discard}>{ac.discardChanges}</Button> : null}
          {!emailVerified && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void sendVerification()}
              disabled={busy !== null || !matchesCurrentEmail}
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
  const submitting = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const ac = AUTH.settings.account

  function changeOpen(value: boolean) {
    setOpen(value)
    if (!value) { setCurrentPassword(''); setNewPassword('') }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    if (!currentPassword || newPassword.length < 8) {
      setError(ac.passwordIncomplete)
      return
    }
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      const failure = await accountRequest(signal => authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true, fetchOptions: { signal } }), passwordUpdateReceipt)
      if (failure) {
        setError(failure)
        return
      }
      changeOpen(false)
      toast.success(ac.changePasswordSuccess)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  if (!hasPassword) {
    return <div id="password" className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-medium">Password</h3><p className="mt-1 text-xs text-muted-foreground">No password is set for this account.</p></div><Button size="sm" variant="outline" asChild><Link href="/forgot-password">Set password</Link></Button></div>
  }

  return <section id="password" className="space-y-4">
    {error ? <Callout variant="danger" title={ac.errorTitle}>{error}</Callout> : null}
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-medium">Password</h3><p className="mt-1 text-xs text-muted-foreground">A password is set for this account.</p></div><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => changeOpen(!open)}>{open ? 'Cancel' : 'Change password'}</Button></div>
    {open ? <form className="space-y-4" onSubmit={changePassword}>
      <Field id="current-password" label={ac.currentPasswordLabel}>{(fieldProps) => <Input {...fieldProps} type="password" autoComplete="current-password" disabled={busy} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />}</Field>
      <Field id="new-password" label={ac.newPasswordLabel}>{(fieldProps) => <Input {...fieldProps} type="password" autoComplete="new-password" minLength={8} disabled={busy} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />}</Field>
      <Button type="submit" disabled={busy} loading={busy} loadingLabel={ac.saving}>Change password</Button>
    </form> : null}
  </section>
}

export function AccountDangerZone() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const ac = AUTH.settings.account

  function changeOpen(value: boolean) {
    setOpen(value)
    if (!value) setPassword('')
  }

  async function deleteAccount() {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      const failure = await accountRequest(signal => authClient.deleteUser({ password: password || undefined, callbackURL: '/', fetchOptions: { signal } }), deletionEmailReceipt)
      if (failure) {
        setError(failure)
        return
      }
      changeOpen(false)
      toast.success(ac.deleteSuccess)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <>
    {!open && error ? <Callout variant="danger" title={ac.errorTitle}>{error}</Callout> : null}
    <Button type="button" variant="destructive" disabled={busy} onClick={() => changeOpen(true)}>{ac.deleteCta}</Button>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent header={<DialogTitle>{ac.deleteConfirmTitle}</DialogTitle>} className="max-w-md"><DialogHeader><DialogDescription>{ac.deleteConfirmDescription}</DialogDescription></DialogHeader>
        {error ? <Callout variant="danger" title={ac.errorTitle}>{error}</Callout> : null}
        <Field id="delete-password" label={ac.deletePasswordLabel}>{(fieldProps) => <Input {...fieldProps} type="password" autoComplete="current-password" disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} />}</Field>
        <DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="outline" onClick={() => changeOpen(false)}>{ac.deleteCancel}</Button><Button type="button" variant="destructive" disabled={busy} loading={busy} loadingLabel={ac.deleteConfirming} onClick={() => void deleteAccount()}>{ac.deleteConfirmLabel}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
