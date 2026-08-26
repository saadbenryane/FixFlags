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
import { Container } from '@/components/ui/container'
import { AUTH } from '@/lib/marketing/copy'
import { isGoogleSearchConsoleConfigured } from '@/lib/integrations/google-search-console'
import { Callout } from '@/components/ui/callout'

type SettingsSearchParams = {
  gsc_connected?: string | string[]
  error?: string | string[]
}

const GSC_ERRORS: Record<string, string> = {
  gsc_not_configured: 'Google Search Console is not configured on this deployment.',
  gsc_connect_failed: 'Google Search Console could not be connected. Try again.',
  gsc_denied: 'Google Search Console access was not granted.',
  gsc_invalid_state: 'That Google Search Console connection link expired. Try again.',
  gsc_no_sites: 'No verified Google Search Console properties were available for this account.',
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

  const planDef = PLAN_DEFINITIONS[user.plan]
  const hasPassword = user.accounts.some((a) => a.password != null)
  const linkedProviders = user.accounts
    .map((a) => a.providerId)
    .filter((p) => p === 'google' || p === 'github')

  return (
    <Container variant="narrow" className="py-8 space-y-8">
      <PageHeader title="Settings" description="Manage your account and security." />

      {gscConnected ? (
        <Callout variant="success" title="Google Search Console connected" />
      ) : errorCode ? (
        <Callout variant="warning" title="Google Search Console was not connected">
          {GSC_ERRORS[errorCode] ?? 'Try connecting again.'}
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
          <CardTitle className="text-base">{AUTH.settings.account.title}</CardTitle>
          <CardDescription>{AUTH.settings.account.description}</CardDescription>
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
    </Container>
  )
}
