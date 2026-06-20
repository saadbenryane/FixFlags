'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LockedContentTeaserProps {
  label?: string
  signUpHref?: string
  className?: string
}

export function LockedContentTeaser({
  label = 'Sign up to view',
  signUpHref = '/sign-up',
  className,
}: LockedContentTeaserProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-inner)] border border-dashed border-border/50 bg-muted/20 px-4 py-3',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-pretty">{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button asChild size="sm">
          <Link href={signUpHref}>Create free account</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </div>
  )
}
