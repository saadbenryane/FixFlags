import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Heading, Muted } from '@/components/ui/typography'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { AccountSettingsForms } from '@/components/settings/AccountSettingsForms'

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { name: true, email: true, emailVerified: true, plan: true },
  })

  if (!user) return null

  const planDef = PLAN_DEFINITIONS[user.plan]

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 space-y-6">
      <div className="space-y-1">
        <Heading as="h1">Settings</Heading>
        <Muted>Account and integrations</Muted>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Profile, identity, password, and account lifecycle</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Plan</span>
            <span>{planDef.name}</span>
          </div>
          <AccountSettingsForms
            initialName={user.name ?? ''}
            email={user.email}
            emailVerified={user.emailVerified}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API Keys</CardTitle>
            <CardDescription>Connect QualityOS to Cursor, Claude, or Windsurf</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="w-full">
              <Link href="/settings/api-keys">Manage API keys</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing</CardTitle>
            <CardDescription>Plan, usage, and subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="w-full">
              <Link href="/billing">View billing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
