import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/sign-in')

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">QualityOS</Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
          <Link href="/settings/api-keys" className="text-sm text-muted-foreground hover:text-foreground">API Keys</Link>
          <Link href="/billing" className="text-sm text-muted-foreground hover:text-foreground">Billing</Link>
          <span className="text-sm text-muted-foreground">{session.user.email}</span>
        </div>
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  )
}
