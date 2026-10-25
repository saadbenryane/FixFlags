'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { Button } from '@/components/ui/button'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { useReportAuthGate } from '@/components/auth/ReportAuthGate'
import { Eye, Copy } from 'lucide-react'
import { siteNavigationRoot } from '@/lib/sites/navigation-continuity'
import { siteContinuationHref, type SiteActionAvailability } from '@/lib/sites/viewer-actions'

export function SiteActionContinuation({ availability, destination, action, compact = false, label, icon, variant = 'outline' }: {
  availability: SiteActionAvailability
  destination: string
  action: 'check' | 'copy' | 'monitoring' | 'integrations' | 'history'
  compact?: boolean
  label?: string
  icon?: React.ReactNode
  variant?: 'outline' | 'ghost' | 'default'
}) {
  const gate = useReportAuthGate()
  if (availability === 'available') return null
  const text = label ?? (action === 'check' ? SITE_BOARD_COPY.checkAgain : action === 'copy' ? SITE_BOARD_COPY.copyPrompt : C.access[action])
  const preserveContext = action === 'check' || action === 'copy'
  if (availability === 'sign_in' && gate) return <Button variant={variant} size={compact ? 'sm' : 'default'} className="min-h-11" data-site-return-focus={action}
    data-site-auth-next={destination} data-site-auth-context={preserveContext ? 'current' : undefined} aria-haspopup="dialog" onClick={event => {
      const current = window.location
      const sameSite = siteNavigationRoot(current.pathname) === siteNavigationRoot(new URL(destination, current.origin).pathname)
      gate.open({ reason: 'save-report', nextPath: preserveContext && sameSite ? current.pathname + current.search + current.hash : destination, trigger: event.currentTarget })
    }}>{icon}{text}</Button>
  return <Button asChild variant={variant} size={compact ? 'sm' : 'default'} className="min-h-11" data-site-return-focus={action}>
    <Link href={siteContinuationHref(availability, destination) as Route}>
      {icon}{text}
    </Link>
  </Button>
}

export function SitePromptAccessActions({ availability, destination, label }: {
  availability: SiteActionAvailability; destination: string; label: string;
}) {
  return <span className="inline-flex flex-wrap items-center gap-1">
    <SiteActionContinuation availability={availability} destination={destination} action="copy" compact label={label} icon={<Copy aria-hidden />} />
    <SiteActionContinuation availability={availability} destination={destination} action="copy" compact label={SITE_BOARD_COPY.viewPrompt} icon={<Eye aria-hidden />} variant="ghost" />
  </span>
}
