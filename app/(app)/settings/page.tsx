import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Heading, Muted } from '@/components/ui/typography'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { name: true, email: true, plan: true },
  })

  if (!user) return null

  const planDef = PLAN_DEFINITIONS[user.plan]

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Heading as="h1">Settings</Heading>
        <Muted>Account and integrations</Muted>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Name</span>
            <span>{user.name || '—'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Email</span>
            <span>{user.email}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Plan</span>
            <span>{planDef.name}</span>
          </div>
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
