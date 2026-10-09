import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { signInUrl } from '@/lib/auth/redirect-path'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { AccountDangerZone, AccountSettingsForms } from '@/components/settings/AccountSettingsForms'
import { ConnectedAccounts } from '@/components/settings/ConnectedAccounts'
import { PageHeader } from '@/components/layout/PageHeader'
import { AUTH } from '@/lib/marketing/copy'
import { isGithubOAuthConfigured, isGoogleOAuthConfigured } from '@/lib/auth/env'

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect(signInUrl('/settings'))

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      plan: true,
      twoFactorEnabled: true,
      accounts: {
        select: { providerId: true, password: true },
      },
      passkeys: { select: { id: true } },
    },
  })

  if (!user) notFound()

  const settingsCopy = AUTH.settings

  const planDef = PLAN_DEFINITIONS[user.plan]
  const hasPassword = user.accounts.some((a) => a.password != null)
  const linkedProviders = user.accounts
    .map((a) => a.providerId)
    .filter((p) => p === 'google' || p === 'github')

  return (
    <div className="space-y-8">
      <PageHeader title={settingsCopy.pageTitle} description={settingsCopy.pageDescription} />

      <Card variant="subtle">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your plan, name, and email address.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountSettingsForms
            initialName={user.name ?? ''}
            email={user.email}
            emailVerified={user.emailVerified}
            planName={planDef.name}
            isPaid={user.plan !== 'FREE'}
          />
        </CardContent>
      </Card>

      <ConnectedAccounts
        email={user.email}
        emailVerified={user.emailVerified}
        hasPassword={hasPassword}
        passkeyCount={user.passkeys.length}
        linkedProviders={linkedProviders}
        twoFactorEnabled={user.twoFactorEnabled}
        availableProviders={[
          ...(isGoogleOAuthConfigured() ? ['google' as const] : []),
          ...(isGithubOAuthConfigured() ? ['github' as const] : []),
        ]}
      />

      <Card variant="subtle" className="border-destructive/30">
        <CardHeader><CardTitle className="text-base">Danger zone</CardTitle><CardDescription>Permanently remove this FixFlags account.</CardDescription></CardHeader>
        <CardContent><AccountDangerZone /></CardContent>
      </Card>
    </div>
  )
}
