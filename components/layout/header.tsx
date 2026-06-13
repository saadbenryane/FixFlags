'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { useState } from 'react'
import { BRAND } from '@/lib/marketing/copy'
import { ADMIN_NAV, APP_NAV, MARKETING_NAV } from '@/lib/site/nav'
import { Container } from '@/components/ui/container'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { SignOutButton } from '@/components/auth/SignOutButton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export type HeaderVariant = 'marketing' | 'app' | 'admin'

interface HeaderProps {
  variant?: HeaderVariant
  logoHref?: string
  right?: React.ReactNode
  className?: string
  userEmail?: string | null
  showAdmin?: boolean
}

export function Header({
  variant = 'marketing',
  logoHref,
  right,
  className,
  userEmail,
  showAdmin,
}: HeaderProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const navLinks =
    variant === 'app' ? APP_NAV : variant === 'admin' ? ADMIN_NAV : MARKETING_NAV

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  const defaultLogoHref =
    variant === 'app' || variant === 'admin' ? '/dashboard' : '/'

  const defaultRight =
    variant === 'app' ? (
      <AppHeaderRight userEmail={userEmail} showAdmin={showAdmin} />
    ) : variant === 'admin' ? (
      <AdminHeaderRight />
    ) : (
      <Button
        variant="default"
        size="sm"
        asChild
        className="ml-2 bg-foreground text-background hover:bg-foreground/90"
      >
        <Link href="/sign-in">Sign in</Link>
      </Button>
    )

  const resolvedRight = right ?? defaultRight

  return (
    <header
      className={cn(
        'sticky top-0 z-navbar h-16 border-b border-border/50 bg-background/80 glass-surface backdrop-blur-xl',
        className
      )}
    >
      <Container className="flex h-full items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={logoHref ?? defaultLogoHref} className="font-display text-xl tracking-tight shrink-0">
            {BRAND.name}
          </Link>
          {variant === 'admin' && (
            <span className="hidden sm:inline rounded bg-destructive px-2 py-0.5 text-[10px] font-medium uppercase tracking-label text-destructive-foreground">
              Admin
            </span>
          )}
        </div>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={cn(
                'rounded-full px-3 py-2 text-sm transition-colors duration-200 hover:bg-accent hover:text-foreground',
                isActive(link.href)
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
          {resolvedRight}
        </div>

        <div className="flex md:hidden items-center gap-1">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle>{BRAND.name}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-accent',
                      isActive(link.href) && 'bg-accent'
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="mt-4 border-t pt-4">{resolvedRight}</div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  )
}

function AppHeaderRight({
  userEmail,
  showAdmin,
}: {
  userEmail?: string | null
  showAdmin?: boolean
}) {
  return (
    <div className="ml-2 flex items-center gap-2">
      {showAdmin && (
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">Admin</Link>
        </Button>
      )}
      {userEmail && (
        <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground lg:inline">
          {userEmail}
        </span>
      )}
      <SignOutButton />
    </div>
  )
}

function AdminHeaderRight() {
  return (
    <div className="ml-2 flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard">Dashboard</Link>
      </Button>
      <SignOutButton />
    </div>
  )
}
