import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { signInUrl } from '@/lib/auth/redirect-path'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { AccountSettingsForms } from '@/components/settings/AccountSettingsForms'
import { ConnectedAccounts } from '@/components/settings/ConnectedAccounts'
import { PageHeader } from '@/components/layout/PageHeader'
import { AUTH } from '@/lib/marketing/copy'

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

      <ConnectedAccounts
        email={user.email}
        emailVerified={user.emailVerified}
        hasPassword={hasPassword}
        passkeyCount={user.passkeys.length}
        linkedProviders={linkedProviders}
        twoFactorEnabled={user.twoFactorEnabled}
      />

      <Card variant="subtle">
        <CardHeader>
          <CardTitle className="text-base">{settingsCopy.account.title}</CardTitle>
          <CardDescription>{settingsCopy.account.description}</CardDescription>
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
    </div>
  )
}
