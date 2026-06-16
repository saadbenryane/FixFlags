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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) {
    redirect(signInUrl(await getRequestedPath('/dashboard')))
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, id: true },
  })
  const showAdmin = user ? isAdminUser(user) : false

  return (
    <SiteShell
      variant="app"
      userEmail={session.user.email}
      showAdmin={showAdmin}
    >
      {children}
    </SiteShell>
  )
}
