'use client'

import { AUTH } from '@/lib/marketing/copy'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PasskeyTwoFactorSettings } from '@/components/settings/PasskeyTwoFactorSettings'

interface Props {
  email: string
  emailVerified: boolean
  hasPassword: boolean
  passkeyCount: number
  linkedProviders: string[]
  twoFactorEnabled: boolean
}

export function ConnectedAccounts({
  email,
  emailVerified,
  hasPassword,
  passkeyCount,
  linkedProviders,
  twoFactorEnabled,
}: Props) {
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
      detail: isGoogle ? email : AUTH.connectedAccounts.notConnected,
    },
    {
      label: AUTH.connectedAccounts.github,
      connected: isGithub,
      detail: isGithub ? email : AUTH.connectedAccounts.notConnected,
    },
    {
      label: AUTH.connectedAccounts.password,
      connected: hasPassword,
      detail: hasPassword
        ? emailVerified
          ? AUTH.connectedAccounts.connected
          : AUTH.connectedAccounts.notConnected
        : AUTH.connectedAccounts.noPassword,
    },
  ]

  return (
    <Card variant="subtle">
      <CardHeader>
        <CardTitle className="text-base">{AUTH.connectedAccounts.title}</CardTitle>
        <CardDescription>{AUTH.connectedAccounts.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/60 overflow-hidden rounded-card border border-border/60">
          {methods.map((method) => (
            <li key={method.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{method.label}</p>
                <p className="text-xs text-muted-foreground">{method.detail}</p>
              </div>
              <Badge variant={method.connected ? 'default' : 'secondary'}>
                {method.connected
                  ? AUTH.connectedAccounts.connected
                  : AUTH.connectedAccounts.notConnected}
              </Badge>
            </li>
          ))}
        </ul>
        {primaryMethod && !hasPassword && passkeyCount === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {AUTH.connectedAccounts.signedInVia(primaryMethod)}
          </p>
        )}
        <div className="mt-6 border-t border-border/60 pt-6">
          <PasskeyTwoFactorSettings
            twoFactorEnabled={twoFactorEnabled}
            hasPassword={hasPassword}
          />
        </div>
      </CardContent>
    </Card>
  )
}
