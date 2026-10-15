'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/analytics/events'
import { readOrCreateAnalyticsJourneyId } from '@/lib/analytics/journey-id'
import type { ComponentProps } from 'react'

const PUBLIC_PATHS = new Set([
  '/', '/new', '/how-it-works', '/coverage', '/security', '/use-cases', '/samples',
  '/integrations', '/pricing', '/waitlist', '/request-demo', '/faq', '/help', '/docs',
  '/blog', '/changelog', '/privacy', '/terms', '/tools/meta-preview', '/tools/placeholder-detector',
])

export function PublicLink({ target, children, onClick, ...props }: ComponentProps<typeof Link> & { target: string }) {
  // Public navigation does not preload every visible footer destination.
  return <Link prefetch={false} {...props} onClick={event => {
    trackPublicNavigation(target)
    onClick?.(event)
  }}>{children}</Link>
}

export function trackPublicNavigation(target: string) {
  const page = window.location.pathname
  if (PUBLIC_PATHS.has(page)) trackEvent('marketing_interaction', { page, action: 'navigate', target, journey_id: readOrCreateAnalyticsJourneyId() ?? undefined })
}

export function PublicDisclosure({ page, target, summary, children, className }: {
  page: string; target: string; summary: string; children: React.ReactNode; className?: string
}) {
  return <details className={className} onToggle={event => {
    if (event.currentTarget.open && PUBLIC_PATHS.has(page) && PUBLIC_PATHS.has(window.location.pathname)) trackEvent('marketing_interaction', { page, action: 'expand', target, journey_id: readOrCreateAnalyticsJourneyId() ?? undefined })
  }}>
    <summary className="flex min-h-11 cursor-pointer items-center font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{summary}</summary>
    {children}
  </details>
}
