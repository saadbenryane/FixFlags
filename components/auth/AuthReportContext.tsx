'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { ArrowLeft, Flag } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { AUTH } from '@/lib/marketing/copy'
import { useReportAuthContext } from '@/hooks/useReportAuthContext'

export function AuthReportContext({ next }: { next: string | null }) {
  const { hostname, reportHref, isReportContext } = useReportAuthContext(next)

  if (!isReportContext || !reportHref) return null

  return (
    <Card className="space-y-3 bg-brand/[0.045] p-4 shadow-none" role="region" aria-label="Report being saved">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Flag className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {hostname ? AUTH.reportContext.title(hostname) : AUTH.reportContext.loadingTitle}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {AUTH.reportContext.body}
          </p>
        </div>
      </div>
      <Link
        href={reportHref as Route}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {AUTH.reportContext.backCta}
      </Link>
    </Card>
  )
}
