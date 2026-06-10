import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'

function isAdmin(userId: string): boolean {
  const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return adminIds.includes(userId)
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user?.id || !isAdmin(session.user.id)) {
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
          <Link href="/admin/feedback" className="text-sm text-muted-foreground hover:text-foreground">Feedback</Link>
        </div>
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  )
}
