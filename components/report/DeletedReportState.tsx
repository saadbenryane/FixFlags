import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { HelpSupportActions } from '@/components/help/HelpSupportActions'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { AUDIT_ERRORS, REPORT_COPY, SYSTEM_COPY } from '@/lib/marketing/copy'
import { helpHrefForSurface } from '@/lib/help/contextual'

/**
 * Helpful empty state for a report route whose audit no longer exists
 * (deleted, expired, or never created). Replaces the raw generic 404 with
 * report-aware copy and forward actions instead of a dead end.
 */
export function DeletedReportState() {
  return (
    <Container variant="report" className="space-y-5 py-6 sm:py-8">
      <section
        aria-labelledby="deleted-report-title"
        className="space-y-5 rounded-card bg-background/85 p-4 shadow-glass-deep glass-surface sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted/55 text-muted-foreground">
            <FileQuestion className="h-4 w-4" aria-hidden />
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
          <h1 id="deleted-report-title" className="text-2xl font-semibold tracking-heading text-balance">
            {AUDIT_ERRORS.reportNotFoundTitle}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {AUDIT_ERRORS.reportNotFoundBody} Run a new check to see this site&apos;s current
            FixFlags report.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/#audit">{REPORT_COPY.workspace.unavailableState.reviewSite}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">{SYSTEM_COPY.actions.dashboard}</Link>
          </Button>
        </div>

        <HelpSupportActions
          helpHref={helpHrefForSurface('audit_failure')}
          articleTitle="Why a check failed"
        />
      </section>
    </Container>
  )
}
