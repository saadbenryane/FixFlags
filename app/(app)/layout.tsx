import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getRequestedPath, signInUrl } from '@/lib/auth/redirect-path'
import { prisma } from '@/lib/db'
import { isAdminUser } from '@/lib/auth/permissions'
import { SiteShell } from '@/components/layout/site-shell'
import { BRAND } from '@/lib/marketing/copy'

export const metadata: Metadata = {
  title: BRAND.name,
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) {
    redirect(signInUrl(await getRequestedPath('/dashboard')))
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, id: true },
  })
  if (!user) {
    redirect(signInUrl(await getRequestedPath('/dashboard')))
  }
  const showAdmin = isAdminUser(user)

  return (
    <SiteShell
      variant="app"
      showAdmin={showAdmin}
    >
      {children}
    </SiteShell>
  )
}
