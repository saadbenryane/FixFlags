'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ReportAiGateProps {
  locked: boolean
  signUpHref?: string
  headline?: string
  body?: string
  children: React.ReactNode
  className?: string
}

export function ReportAiGate({
  locked,
  signUpHref = '/sign-up',
  headline = 'Unlock AI review',
  body = 'Create a free account to see fix prompts, rubric analysis, and the full AI review.',
  children,
  className,
}: ReportAiGateProps) {
  if (!locked) {
    return <>{children}</>
  }

  return (
    <div className={cn('relative', className)}>
      <div className="pointer-events-none select-none blur-sm opacity-60">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="max-w-sm rounded-card border bg-background/95 p-5 text-center shadow-lg backdrop-blur-sm">
          <p className="text-sm font-semibold text-foreground">{headline}</p>
          <p className="mt-2 text-xs text-muted-foreground text-pretty">{body}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link href={signUpHref}>Create free account</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
