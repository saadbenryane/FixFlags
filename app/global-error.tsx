'use client'

import './globals.css'
import { fontVariables } from '@/lib/design/fonts'
import { PageTitle } from '@/components/ui/typography'

export default function GlobalError({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        className={`${fontVariables} flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground font-sans antialiased`}
      >
        <PageTitle className="text-2xl">Something went wrong</PageTitle>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          A critical error occurred. Please try again or refresh the page.
        </p>
        <button
          onClick={() => reset()}
          className="mt-6 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-brand-hover"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
