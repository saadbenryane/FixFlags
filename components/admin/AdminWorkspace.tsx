'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ADMIN_COPY } from '@/lib/marketing/copy/admin'
import { cn } from '@/lib/utils'
export function AdminWorkspace({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    [open, setOpen] = useState(false)
  function links() {
    return (
      <nav aria-label="Admin navigation" className="grid gap-1">
        {ADMIN_COPY.navigation.map((item) => {
          const active =
            item.href === '/admin'
              ? path === item.href
              : path.startsWith(item.href) ||
                (item.label === 'Operations' &&
                  /\/admin\/(audits|evidence|operating-plan)/.test(path)) ||
                (item.label === 'Sites' && path.startsWith('/admin/shops')) ||
                (item.label === 'Growth' && /\/admin\/(leads|waitlist)/.test(path))
          return (
            <Link
              href={item.href as Route}
              key={item.href}
              aria-current={active ? 'page' : undefined}
              onClick={() => setOpen(false)}
              className={cn(
                'rounded-lg px-3 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                active
                  ? 'bg-muted font-semibold'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    )
  }
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-modal focus:bg-background focus:p-4"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-48 flex-col gap-8 bg-muted/20 p-4 lg:flex">
        <Logo variant="lockup" size="sm" href="/admin" />
        {links()}
        <Link href="/dashboard" className="mt-auto px-3 py-3 text-sm text-muted-foreground">
          Open app
        </Link>
      </aside>
      <div className="flex items-center gap-3 px-4 py-3 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open admin navigation"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
        <Logo variant="lockup" size="sm" href="/admin" />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent header={<DialogTitle>Admin workspace</DialogTitle>}>
          <DialogDescription>Choose an area to work in.</DialogDescription>
          {links()}
          <Link href="/dashboard">Open app</Link>
        </DialogContent>
      </Dialog>
      <main id="admin-main" tabIndex={-1} className="min-w-0 lg:ml-48">
        {children}
      </main>
    </div>
  )
}
