import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isAdminUser } from '@/lib/auth/permissions'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user?.id) {
    redirect('/sign-in')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  })

  if (!user || !isAdminUser(user)) {
    redirect('/')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b px-6 py-4 flex items-center gap-6">
        <Link href="/" className="font-bold text-lg tracking-tight">QualityOS</Link>
        <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded font-medium">ADMIN</span>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">Metrics</Link>
          <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">Users</Link>
          <Link href="/admin/audits" className="text-sm text-muted-foreground hover:text-foreground">Audits</Link>
          <Link href="/admin/feedback" className="text-sm text-muted-foreground hover:text-foreground">Feedback</Link>
        </div>
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  )
}
