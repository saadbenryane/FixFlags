import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getRequestedPath, signInUrl } from '@/lib/auth/redirect-path'
import { prisma } from '@/lib/db'
import { isAdminUser } from '@/lib/auth/permissions'
import { SiteShell } from '@/components/layout/site-shell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user?.id) {
    redirect(signInUrl(await getRequestedPath('/admin')))
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  })

  if (!user || !isAdminUser(user)) {
    redirect('/')
  }

  return (
    <SiteShell variant="admin" logoHref="/dashboard">
      {children}
    </SiteShell>
  )
}
