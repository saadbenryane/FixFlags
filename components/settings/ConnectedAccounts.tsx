'use client'

import { AUTH } from '@/lib/marketing/copy'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PasskeyTwoFactorSettings } from '@/components/settings/PasskeyTwoFactorSettings'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { useState } from 'react'
import { PasswordSettings } from '@/components/settings/AccountSettingsForms'

interface Props {
  email: string
  emailVerified: boolean
  hasPassword: boolean
  passkeyCount: number
  linkedProviders: string[]
  twoFactorEnabled: boolean
  availableProviders: Array<'google' | 'github'>
}

export function ConnectedAccounts({
  email,
  hasPassword,
  passkeyCount,
  linkedProviders,
  twoFactorEnabled,
  availableProviders = [],
}: Props) {
  const [linking, setLinking] = useState<string | null>(null)
  const isGoogle = linkedProviders.includes('google')
  const isGithub = linkedProviders.includes('github')
  const primaryMethod = isGoogle
    ? AUTH.connectedAccounts.google
    : isGithub
      ? AUTH.connectedAccounts.github
      : null

  const methods = [
    {
      label: AUTH.connectedAccounts.google,
      connected: isGoogle,
      detail: email,
    },
    {
      label: AUTH.connectedAccounts.github,
      connected: isGithub,
      detail: email,
    },
  ].filter((method) => method.connected)

  async function connect(provider: 'google' | 'github') {
    setLinking(provider)
    const result = await authClient.linkSocial({ provider, callbackURL: '/settings' })
    if (result.error) setLinking(null)
  }

  const available = availableProviders.filter((provider) => !linkedProviders.includes(provider))

  return (<>
    <Card variant="subtle">
      <CardHeader>
        <CardTitle className="text-base">Sign-in methods</CardTitle>
        <CardDescription>Choose how you can sign in to this account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <PasswordSettings hasPassword={hasPassword} />
        {methods.length > 0 || available.length > 0 ? <div className="border-t border-border/60 pt-5">
        <h3 className="mb-2 text-sm font-medium">Connected accounts</h3>
        <ul className="divide-y divide-border/60 overflow-hidden rounded-card border border-border/60">
          {methods.map((method) => (
            <li key={method.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{method.label}</p>
                <p className="text-xs text-muted-foreground">{method.detail}</p>
              </div>
              <Badge variant="default">Connected</Badge>
            </li>
          ))}
          {available.map((provider) => <li key={provider} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div><p className="text-sm font-medium">{provider === 'google' ? 'Google' : 'GitHub'}</p><p className="text-xs text-muted-foreground">Available sign-in method</p></div>
            <Button size="sm" variant="outline" disabled={Boolean(linking)} onClick={() => void connect(provider)}>{linking === provider ? 'Connecting…' : 'Connect'}</Button>
          </li>)}
        </ul></div> : null}
        {primaryMethod && !hasPassword && passkeyCount === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {AUTH.connectedAccounts.signedInVia(primaryMethod)}
          </p>
        )}
      </CardContent>
    </Card>
    <Card variant="subtle">
      <CardHeader><CardTitle className="text-base">Security</CardTitle><CardDescription>Protect this account with passkeys and two-factor authentication.</CardDescription></CardHeader>
      <CardContent><PasskeyTwoFactorSettings twoFactorEnabled={twoFactorEnabled} hasPassword={hasPassword} /></CardContent>
    </Card>
  </>)
}
