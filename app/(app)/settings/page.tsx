import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { signInUrl } from '@/lib/auth/redirect-path'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { AccountSettingsForms } from '@/components/settings/AccountSettingsForms'
import { ConnectedAccounts } from '@/components/settings/ConnectedAccounts'
import { GscConnectionCard } from '@/components/settings/GscConnectionCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { AUTH } from '@/lib/marketing/copy'
import { isGoogleSearchConsoleConfigured } from '@/lib/integrations/google-search-console'
import { Callout } from '@/components/ui/callout'

type SettingsSearchParams = {
  gsc_connected?: string | string[]
  error?: string | string[]
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<SettingsSearchParams>
}) {
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
      gscConnection: { select: { siteUrl: true } },
    },
  })

  if (!user) notFound()

  const query = searchParams ? await searchParams : {}
  const errorCode = typeof query.error === 'string' ? query.error : null
  const gscConnected = query.gsc_connected === '1'
  const settingsCopy = AUTH.settings

  const planDef = PLAN_DEFINITIONS[user.plan]
  const hasPassword = user.accounts.some((a) => a.password != null)
  const linkedProviders = user.accounts
    .map((a) => a.providerId)
    .filter((p) => p === 'google' || p === 'github')

  return (
    <div className="space-y-8">
      <PageHeader title={settingsCopy.pageTitle} description={settingsCopy.pageDescription} />

      {gscConnected ? (
        <Callout variant="success" title={settingsCopy.gscConnectedTitle} />
      ) : errorCode ? (
        <Callout variant="warning" title={settingsCopy.gscNotConnectedTitle}>
          {settingsCopy.gscErrors[errorCode] ?? settingsCopy.gscRetry}
        </Callout>
      ) : null}

      <ConnectedAccounts
        email={user.email}
        emailVerified={user.emailVerified}
        hasPassword={hasPassword}
        passkeyCount={user.passkeys.length}
        linkedProviders={linkedProviders}
        twoFactorEnabled={user.twoFactorEnabled}
      />

      {isGoogleSearchConsoleConfigured() && (
        <GscConnectionCard
          connected={Boolean(user.gscConnection)}
          siteUrl={user.gscConnection?.siteUrl ?? null}
        />
      )}

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
