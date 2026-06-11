import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { MarketingShell } from '@/components/layout/marketing-shell'

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  return <MarketingShell session={session}>{children}</MarketingShell>
}
