import type { Route } from 'next'
import Link from 'next/link'
import { Globe2, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { REPORT_COPY } from '@/lib/marketing/copy'

export function ReportWorkspaceState({
  title,
  description,
  actionLabel,
  actionHref,
  kind = 'unavailable',
}: {
  title: string
  description: string
  actionLabel: string
  actionHref: string
  kind?: 'forbidden' | 'unavailable' | 'failed'
}) {
  const Icon = kind === 'forbidden' ? LockKeyhole : Globe2

  return (
    <Container variant="report" className="space-y-5 py-6 sm:py-8">
      <section className="space-y-5 rounded-card bg-background/85 p-4 shadow-glass-deep glass-surface sm:p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted/55 text-muted-foreground">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">
              {REPORT_COPY.workspace.unavailableState.identity}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {REPORT_COPY.workspace.unavailableState.identityBody}
            </p>
          </div>
        </div>

        <header className="max-w-2xl space-y-2">
          <h1 className="text-2xl font-semibold tracking-heading text-balance">
            {title}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
        </header>

        <Button asChild>
          <Link href={actionHref as Route}>{actionLabel}</Link>
        </Button>
      </section>
    </Container>
  )
}
