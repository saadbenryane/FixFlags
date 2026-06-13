'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useState } from 'react'
import { BRAND } from '@/lib/marketing/copy'
import { Container } from '@/components/ui/container'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/samples', label: 'Samples' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs/mcp', label: 'MCP' },
  { href: '/faq', label: 'FAQ' },
]

interface HeaderProps {
  right?: React.ReactNode
  className?: string
}

export function Header({ right, className }: HeaderProps) {
  const [open, setOpen] = useState(false)

  return (
    <header
      className={cn(
        'sticky top-0 z-navbar h-16 border-b border-border/50 bg-background/80 glass-surface backdrop-blur-xl',
        className
      )}
    >
      <Container className="flex h-full items-center justify-between">
        <Link href="/" className="font-display text-xl tracking-tight">
          {BRAND.name}
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 rounded-full hover:bg-accent"
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
          {right ?? (
            <Button variant="default" size="sm" asChild className="ml-2 bg-foreground text-background hover:bg-foreground/90">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>

        {/* Mobile nav */}
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
              <nav className="flex flex-col gap-1 mt-6">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="px-3 py-3 text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="pt-4 mt-2 border-t">
                  {right ?? (
                    <Button asChild className="w-full">
                      <Link href="/sign-in" onClick={() => setOpen(false)}>
                        Sign in
                      </Link>
                    </Button>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  )
}
