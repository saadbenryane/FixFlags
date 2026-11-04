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
import { AUTH } from '@/lib/marketing/copy-barrel'
import { isGithubOAuthConfigured, isGoogleOAuthConfigured } from '@/lib/auth/env'
import { EmailPreferences } from '@/components/settings/EmailPreferences'
import { DEFAULT_NOTIFICATION_PREFERENCES, readNotificationPreferences, summaryCadence } from '@/lib/notifications/preferences'
import { loadEmailDeliveryHistory, notificationRecipientAllowed } from '@/lib/email/delivery-events'
import { monitored } from '@/lib/notifications/contracts'

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
      notificationPreference: true,
      projects: { where: monitored, select: { watchInterval: true, watchEveryMinutes: true } },
      accounts: {
        select: { providerId: true, password: true },
      },
      passkeys: { select: { id: true } },
    },
  })

  if (!user) notFound()
  const [history, recipientAllowed] = await Promise.all([loadEmailDeliveryHistory(session.user.id), notificationRecipientAllowed(user.email)])

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
          <CardTitle as="h2" className="text-base">Profile</CardTitle>
          <CardDescription>Your plan, name, and email address.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountSettingsForms
            key={session.user.id}
            ownerId={session.user.id}
            initialName={user.name ?? ''}
            email={user.email}
            emailVerified={user.emailVerified}
            planName={planDef.name}
            isPaid={user.plan !== 'FREE'}
          />
        </CardContent>
      </Card>

      <ConnectedAccounts
        key={session.user.id}
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

      <EmailPreferences key={session.user.id} ownerId={session.user.id} initial={user.notificationPreference ? readNotificationPreferences(user.notificationPreference) : DEFAULT_NOTIFICATION_PREFERENCES}
        nextSendAt={user.notificationPreference?.nextSendAt?.toISOString() ?? null} email={user.email}
        emailVerified={user.emailVerified} hasMonitoredSites={user.projects.length > 0}
        followCadence={summaryCadence(DEFAULT_NOTIFICATION_PREFERENCES, user.projects)} history={history} blocked={!recipientAllowed} />

      <Card variant="subtle" className="border-destructive/30">
        <CardHeader><CardTitle as="h2" className="text-base">Danger zone</CardTitle><CardDescription>Permanently remove this FixFlags account.</CardDescription></CardHeader>
        <CardContent><AccountDangerZone key={session.user.id} /></CardContent>
      </Card>
    </div>
  )
}
