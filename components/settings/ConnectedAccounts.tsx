'use client'

import { AUTH } from '@/lib/marketing/copy'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Props {
  email: string
  emailVerified: boolean
  hasPassword: boolean
  passkeyCount: number
  linkedProviders: string[]
}

export function ConnectedAccounts({
  email,
  emailVerified,
  hasPassword,
  passkeyCount,
  linkedProviders,
}: Props) {
  const isGoogle = linkedProviders.includes('google')
  const isGithub = linkedProviders.includes('github')
  const primaryMethod = isGoogle ? AUTH.connectedAccounts.google : isGithub ? AUTH.connectedAccounts.github : null

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
      detail: hasPassword ? (emailVerified ? AUTH.connectedAccounts.connected : AUTH.connectedAccounts.notConnected) : AUTH.connectedAccounts.noPassword,
    },
    {
      label: AUTH.connectedAccounts.passkeys,
      connected: passkeyCount > 0,
      detail: AUTH.connectedAccounts.passkeyCount(passkeyCount),
    },
  ]

  return (
    <Card className="border-0 p-5 shadow-card">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{AUTH.connectedAccounts.title}</h2>
        <p className="text-sm text-muted-foreground">{AUTH.connectedAccounts.description}</p>
      </div>
      <ul className="mt-4 divide-y divide-border/60 overflow-hidden rounded-card border border-border/60">
        {methods.map((method) => (
          <li key={method.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{method.label}</p>
              <p className="text-xs text-muted-foreground">{method.detail}</p>
            </div>
            <Badge variant={method.connected ? 'default' : 'secondary'}>
              {method.connected ? AUTH.connectedAccounts.connected : AUTH.connectedAccounts.notConnected}
            </Badge>
          </li>
        ))}
      </ul>
      {primaryMethod && !hasPassword && passkeyCount === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {AUTH.connectedAccounts.signedInVia(primaryMethod)}
        </p>
      )}
    </Card>
  )
}
