import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { signInUrl } from '@/lib/auth/redirect-path'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { AccountSettingsForms } from '@/components/settings/AccountSettingsForms'
import { PasskeyTwoFactorSettings } from '@/components/settings/PasskeyTwoFactorSettings'
import { ConnectedAccounts } from '@/components/settings/ConnectedAccounts'
import { GscConnectionCard } from '@/components/settings/GscConnectionCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Container } from '@/components/ui/container'
import { AUTH } from '@/lib/marketing/copy'
import { isGoogleSearchConsoleConfigured } from '@/lib/integrations/google-search-console'

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
      gscConnection: { select: { siteUrl: true } },
    },
  })

  if (!user) notFound()

  const planDef = PLAN_DEFINITIONS[user.plan]
  const hasPassword = user.accounts.some((a) => a.password != null)
  const linkedProviders = user.accounts
    .map((a) => a.providerId)
    .filter((p) => p === 'google' || p === 'github')

  return (
    <Container variant="narrow" className="py-8 space-y-8">
      <PageHeader title="Settings" description="Manage your account and security." />

      <ConnectedAccounts
        email={user.email}
        emailVerified={user.emailVerified}
        hasPassword={hasPassword}
        passkeyCount={user.passkeys.length}
        linkedProviders={linkedProviders}
      />

      {isGoogleSearchConsoleConfigured() && (
        <GscConnectionCard
          connected={Boolean(user.gscConnection)}
          siteUrl={user.gscConnection?.siteUrl ?? null}
        />
      )}

      <Card variant="subtle">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Name, email, password, and account deletion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">{planDef.name}</span>
          </div>
          <AccountSettingsForms
            initialName={user.name ?? ''}
            email={user.email}
            emailVerified={user.emailVerified}
          />
        </CardContent>
      </Card>

      <Card variant="subtle">
        <CardHeader>
          <CardTitle className="text-base">{AUTH.security.title}</CardTitle>
          <CardDescription>{AUTH.security.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <PasskeyTwoFactorSettings
            twoFactorEnabled={user.twoFactorEnabled}
            hasPassword={hasPassword}
          />
        </CardContent>
      </Card>
    </Container>
  )
}
