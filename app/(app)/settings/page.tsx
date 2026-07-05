import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { signInUrl } from '@/lib/auth/redirect-path'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { AccountSettingsForms } from '@/components/settings/AccountSettingsForms'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect(signInUrl('/settings'))

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, emailVerified: true, plan: true },
  })

  if (!user) notFound()

  const planDef = PLAN_DEFINITIONS[user.plan]

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Account, identity, and password" />

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Profile, identity, password, and account lifecycle</CardDescription>
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
    </div>
  )
}
