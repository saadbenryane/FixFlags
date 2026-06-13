'use client'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Container } from '@/components/ui/container'

interface AuditShellProps {
  children: React.ReactNode
  actions?: React.ReactNode
  session?: { user: { id: string } } | null
}

export function AuditShell({ children, actions, session }: AuditShellProps) {
  const headerRight = session ? (
    <Link
      href="/dashboard"
      className="text-sm font-medium px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
    >
      Dashboard
    </Link>
  ) : undefined

  return (
    <div className="min-h-screen flex flex-col">
      <Header right={headerRight} />
      {actions && (
        <div className="border-b bg-muted/20">
          <Container className="py-3 flex items-center justify-end gap-2 flex-wrap">
            {actions}
          </Container>
        </div>
      )}
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
