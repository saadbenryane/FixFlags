import Link from 'next/link'
import type { Route } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { githubSettingsDestination, githubSiteDestination } from '@/lib/integrations/github-continuation'
import { isGithubRepoAccessConfigured } from '@/lib/integrations/github'
import { GITHUB_CONNECTION_COPY as C } from '@/lib/marketing/copy/github-connection'
import { GithubConnectionControls } from '@/components/settings/GithubConnectionControls'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'

export default async function GithubIntegrationsPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; connected?: string }> }) {
  const params = await searchParams
  const destination = githubSiteDestination(params.next)
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent(githubSettingsDestination(destination))}`)
  const connection = await prisma.githubConnection.findUnique({ where: { userId: session.user.id }, select: { githubLogin: true, revokedAt: true } })
  const error = params.error && Object.hasOwn(C.errors, params.error) ? C.errors[params.error as keyof typeof C.errors] : null
  return <div className="space-y-8">
    {destination ? <Link href={destination as Route} className="inline-flex min-h-11 items-center text-sm underline">{C.back}</Link> : null}
    <PageHeader title={C.title} description={C.description} />
    {error ? <p role="alert">{error}</p> : params.connected === '1' ? <p role="status">{C.connectedReceipt}</p> : null}
    <Card variant="subtle"><CardContent className="space-y-5 pt-6">
      <p>{connection ? connection.revokedAt ? C.revoked : C.connected(connection.githubLogin) : C.disconnected}</p>
      <p className="text-sm text-muted-foreground">{C.behavior}</p><p className="text-sm">{C.permissions}</p>
      <GithubConnectionControls connected={Boolean(connection)} revoked={Boolean(connection?.revokedAt)} configured={isGithubRepoAccessConfigured()} destination={destination} />
    </CardContent></Card>
    <p className="text-sm text-muted-foreground">{C.signingIn} <Link href="/settings" className="underline">{C.account}</Link></p>
  </div>
}
