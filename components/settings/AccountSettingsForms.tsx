'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
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

  async function run(action: string, operation: () => Promise<{ error?: { message?: string } | null }>) {
    setBusy(action)
    setError(null)
    try {
      const result = await operation()
      if (result.error) {
        const message = result.error.message || 'The account update failed'
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
      toast.success('Profile updated')
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
      toast.success('Check your new email to confirm the change')
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
      toast.success('Password changed and other sessions revoked')
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
      toast.success('Verification email sent')
    }
  }

  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault()
    const ok = await confirm({
      title: 'Delete your account?',
      description: 'This permanently deletes your account, audits, screenshots, and API keys.',
      confirmLabel: 'Delete account',
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
      toast.success('Check your email to confirm account deletion')
    }
  }

  return (
    <div className="space-y-8">
      {confirmDialog}
      {error && (
        <Callout variant="danger" title="Could not update account">
          {error}
        </Callout>
      )}

      <Card className="border-0 p-5 shadow-card">
      <form onSubmit={saveProfile} className="space-y-4">
        <h2 className="text-base font-semibold">Profile</h2>
        <div className="space-y-2">
          <label htmlFor="account-name" className="text-sm font-medium">Name</label>
          <Input
            id="account-name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy !== null}>
          {busy === 'profile' ? 'Saving…' : 'Save profile'}
        </Button>
      </form>
      </Card>

      <Card className="border-0 p-5 shadow-card">
      <form onSubmit={changeEmail} className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Email</h2>
          <p className="text-sm text-muted-foreground">
            {emailVerified ? 'Verified' : 'Not verified'}
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="account-email" className="text-sm font-medium">Email address</label>
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
            {busy === 'email' ? 'Sending…' : 'Change email'}
          </Button>
          {!emailVerified && (
            <Button type="button" variant="outline" onClick={sendVerification} disabled={busy !== null}>
              {busy === 'verify' ? 'Sending…' : 'Send verification'}
            </Button>
          )}
        </div>
      </form>
      </Card>

      <Card className="border-0 p-5 shadow-card">
      <form onSubmit={changePassword} className="space-y-4">
        <h2 className="text-base font-semibold">Password</h2>
        <div className="space-y-2">
          <label htmlFor="current-password" className="text-sm font-medium">Current password</label>
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
          <label htmlFor="new-password" className="text-sm font-medium">New password</label>
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
          {busy === 'password' ? 'Changing…' : 'Change password'}
        </Button>
      </form>
      </Card>

      <Card className="bg-destructive/5 p-5 ring-2 ring-destructive/20 shadow-card">
      <form onSubmit={deleteAccount} className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-destructive">Delete account</h2>
          <p className="text-sm text-muted-foreground">
            This permanently removes your audits, screenshots, projects, API keys, and account.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="delete-password" className="text-sm font-medium">Password, if your account has one</label>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
          />
        </div>
        <Button type="submit" variant="destructive" disabled={busy !== null}>
          {busy === 'delete' ? 'Sending confirmation…' : 'Delete account'}
        </Button>
      </form>
      </Card>
    </div>
  )
}
