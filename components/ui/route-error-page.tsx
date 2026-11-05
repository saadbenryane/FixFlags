'use client'

import { useEffect, useTransition } from 'react'
import type { Route } from 'next'
import { AuditShell } from '@/components/layout/audit-shell'
import { SiteShell } from '@/components/layout/site-shell'
import { StatusPage } from '@/components/ui/status-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy-barrel'

type RouteErrorShell = 'marketing' | 'app' | 'admin' | 'audit' | 'none'

export type RouteErrorBoundaryProps = {
  error: unknown
  reset: () => void
  retry?: () => void
}

interface RouteErrorPageProps extends RouteErrorBoundaryProps {
  event: `ui.${string}.error`
  title: string
  description: string
  returnHref: Route
  returnLabel: string
  shell?: RouteErrorShell
  children?: React.ReactNode
}

export function RouteErrorPage({
  error,
  reset,
  retry,
  event,
  title,
  description,
  returnHref,
  returnLabel,
  shell = 'none',
  children,
}: RouteErrorPageProps) {
  const [recovering, startRecovery] = useTransition()
  const issue = error instanceof Error ? error as Error & { digest?: unknown } : null
  const digest = typeof issue?.digest === 'string' ? issue.digest : undefined
  const message = issue?.message ?? (typeof error === 'string' ? error : 'Unknown route error')
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: 'error',
        event,
        digest,
        message,
      })
    )
  }, [digest, message, event])

  const content = (
    <StatusPage
      title={title}
      description={description}
      containerVariant={shell === 'app' || shell === 'audit' ? 'report' : shell === 'none' ? 'narrow' : 'default'}
      actions={[
        { label: SYSTEM_COPY.actions.retry, onClick: () => startRecovery(retry ?? reset), loading: recovering },
        { label: returnLabel, href: returnHref, variant: 'outline' },
      ]}
    >
      {children}
    </StatusPage>
  )

  if (shell === 'audit') return <AuditShell>{content}</AuditShell>
  if (shell === 'none') return content

  return (
    <SiteShell
      variant={shell}
      logoHref={shell === 'admin' ? '/dashboard' : undefined}
    >
      {content}
    </SiteShell>
  )
}
