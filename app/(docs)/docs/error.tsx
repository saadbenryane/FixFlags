'use client'

import type { Route } from 'next'
import { RouteErrorPage } from '@/components/ui/route-error-page'
import { TextLink } from '@/components/ui/text-link'
import { HELP_CENTER, SYSTEM_COPY } from '@/lib/marketing/copy'

export default function DocsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorPage
      error={error}
      reset={reset}
      event="ui.docs.error"
      title={SYSTEM_COPY.errors.docs.title}
      description={SYSTEM_COPY.errors.docs.body}
      returnHref="/docs"
      returnLabel={SYSTEM_COPY.actions.docsHome}
      shell="marketing"
    >
      <p className="text-sm text-muted-foreground">
        <TextLink href={'/docs/troubleshooting' as Route}>Troubleshooting guide</TextLink>
        {' · '}
        <TextLink href="/help">{HELP_CENTER.label}</TextLink>
      </p>
    </RouteErrorPage>
  )
}
