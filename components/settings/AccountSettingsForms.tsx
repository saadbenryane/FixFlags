'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Callout } from '@/components/ui/callout'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

export function AccountSettingsForms({
  initialName,
  email,
  emailVerified,
}: {
  initialName: string
  email: string
  emailVerified: boolean
}) {
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirm()
  const [name, setName] = useState(initialName)
  const [newEmail, setNewEmail] = useState(email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ac = AUTH.settings.account

  async function run(action: string, operation: () => Promise<{ error?: { message?: string } | null }>) {
    setBusy(action)
    setError(null)
    try {
      const result = await operation()
      if (result.error) {
        const message = result.error.message || ac.errorFallback
        setError(message)
        return false
      }
      router.refresh()
      return true
    } finally {
      setBusy(null)
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    if (await run('profile', () => authClient.updateUser({ name: name.trim() }))) {
      toast.success(ac.saveSuccess)
    }
  }

  async function changeEmail(event: React.FormEvent) {
    event.preventDefault()
    if (newEmail === email) return
    if (
      await run('email', () =>
        authClient.changeEmail({
          newEmail: newEmail.trim(),
          callbackURL: '/settings',
        })
      )
    ) {
      toast.success(ac.changeEmailSuccess)
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault()
    if (
      await run('password', () =>
        authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        })
      )
    ) {
      setCurrentPassword('')
      setNewPassword('')
      toast.success(ac.changePasswordSuccess)
    }
  }

  async function sendVerification() {
    if (
      await run('verify', () =>
        authClient.sendVerificationEmail({
          email,
          callbackURL: '/settings',
        })
      )
    ) {
      toast.success(ac.verifySuccess)
    }
  }

  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault()
    const ok = await confirm({
      title: ac.deleteConfirmTitle,
      description: ac.deleteConfirmDescription,
      confirmLabel: ac.deleteConfirmLabel,
      destructive: true,
    })
    if (!ok) return
    if (
      await run('delete', () =>
        authClient.deleteUser({
          password: deletePassword || undefined,
          callbackURL: '/',
        })
      )
    ) {
      toast.success(ac.deleteSuccess)
    }
  }

  return (
    <div className="space-y-8">
      {confirmDialog}
      {error && (
        <Callout variant="danger" title={ac.errorTitle}>
          {error}
        </Callout>
      )}

      <Card className="border-0 p-5 shadow-card">
      <form onSubmit={saveProfile} className="space-y-4">
        <h2 className="text-base font-semibold">{ac.profileTitle}</h2>
        <div className="space-y-2">
          <label htmlFor="account-name" className="text-sm font-medium">{ac.nameLabel}</label>
          <Input
            id="account-name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy !== null}>
          {busy === 'profile' ? ac.saving : ac.saveCta}
        </Button>
      </form>
      </Card>

      <Card className="border-0 p-5 shadow-card">
      <form onSubmit={changeEmail} className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{ac.emailTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {emailVerified ? ac.verified : ac.notVerified}
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="account-email" className="text-sm font-medium">{ac.emailLabel}</label>
          <Input
            id="account-email"
            name="email"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy !== null || newEmail === email}>
            {busy === 'email' ? ac.changeEmailSending : ac.changeEmailCta}
          </Button>
          {!emailVerified && (
            <Button type="button" variant="outline" onClick={sendVerification} disabled={busy !== null}>
              {busy === 'verify' ? ac.verifySending : ac.verifyCta}
            </Button>
          )}
        </div>
      </form>
      </Card>

      <Card className="border-0 p-5 shadow-card">
      <form onSubmit={changePassword} className="space-y-4">
        <h2 className="text-base font-semibold">{ac.passwordTitle}</h2>
        <div className="space-y-2">
          <label htmlFor="current-password" className="text-sm font-medium">{ac.currentPasswordLabel}</label>
          <Input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="new-password" className="text-sm font-medium">{ac.newPasswordLabel}</label>
          <Input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={busy !== null}>
          {busy === 'password' ? ac.changePasswordChanging : ac.changePasswordCta}
        </Button>
      </form>
      </Card>

      <Card className="bg-destructive/5 p-5 ring-2 ring-destructive/20 shadow-card">
      <form onSubmit={deleteAccount} className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-destructive">{ac.deleteTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {ac.deleteDescription}
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="delete-password" className="text-sm font-medium">{ac.deletePasswordLabel}</label>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
          />
        </div>
        <Button type="submit" variant="destructive" disabled={busy !== null}>
          {busy === 'delete' ? ac.deleteConfirming : ac.deleteCta}
        </Button>
      </form>
      </Card>
    </div>
  )
}
