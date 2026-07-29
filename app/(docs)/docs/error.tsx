'use client'

import { RouteErrorPage } from '@/components/ui/route-error-page'

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
      title="This page could not be loaded."
      description="Try the page again. Your product data was not changed."
      returnHref="/docs"
      returnLabel="Documentation home"
      shell="marketing"
    />
  )
}
