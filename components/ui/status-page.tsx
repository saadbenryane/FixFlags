import type { Route } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Heading, Muted } from '@/components/ui/typography'
import { AUDIT_ERRORS } from '@/lib/marketing/copy'

interface Action {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'default' | 'outline' | 'ghost'
  loading?: boolean
}

interface Props {
  title: string
  description: string
  actions?: Action[]
  className?: string
}

export function StatusPage({ title, description, actions = [], className }: Props) {
  return (
    <Container
      variant="report"
      className={`flex flex-col items-center justify-center space-y-4 py-24 text-center ${className ?? ''}`}
    >
      <Heading as="h1">{title}</Heading>
      <Muted className="max-w-md">{description}</Muted>
      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? 'default'}
              onClick={action.onClick}
              disabled={action.loading}
              asChild={Boolean(action.href)}
            >
              {action.href ? <Link href={action.href as Route}>{action.label}</Link> : action.label}
            </Button>
          ))}
        </div>
      )}
    </Container>
  )
}

export function ReportNotFoundStatus() {
  return (
    <StatusPage
      title={AUDIT_ERRORS.reportNotFoundTitle}
      description={AUDIT_ERRORS.reportNotFoundBody}
      actions={[{ label: AUDIT_ERRORS.startCheck, href: '/' }]}
    />
  )
}

export function ReportAccessDeniedStatus({ description }: { description?: string }) {
  return (
    <StatusPage
      title={AUDIT_ERRORS.accessDeniedTitle}
      description={description ?? AUDIT_ERRORS.accessDeniedBody}
      actions={[{ label: AUDIT_ERRORS.goHome, href: '/' }]}
    />
  )
}

export function ReportPollErrorStatus({ onRetry }: { onRetry?: () => void }) {
  return (
    <StatusPage
      title={AUDIT_ERRORS.pollErrorTitle}
      description={AUDIT_ERRORS.pollErrorBody}
      actions={[
        ...(onRetry
          ? [{ label: 'Try again', onClick: onRetry, variant: 'default' as const }]
          : []),
        { label: AUDIT_ERRORS.goHome, href: '/', variant: 'outline' },
      ]}
    />
  )
}
