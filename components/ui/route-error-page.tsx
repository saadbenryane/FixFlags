'use client'

import { useEffect } from 'react'
import type { Route } from 'next'
import { AuditShell } from '@/components/layout/audit-shell'
import { SiteShell } from '@/components/layout/site-shell'
import { StatusPage } from '@/components/ui/status-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy'

type RouteErrorShell = 'marketing' | 'app' | 'admin' | 'audit' | 'none'

interface RouteErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
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
  event,
  title,
  description,
  returnHref,
  returnLabel,
  shell = 'none',
  children,
}: RouteErrorPageProps) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: 'error',
        event,
        digest: error.digest,
        message: error.message,
      })
    )
  }, [error.digest, error.message, event])

  const content = (
    <StatusPage
      title={title}
      description={description}
      containerVariant={shell === 'app' || shell === 'audit' ? 'report' : shell === 'none' ? 'narrow' : 'default'}
      actions={[
        { label: SYSTEM_COPY.actions.retry, onClick: reset },
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
