import Link from 'next/link'
import type { Route } from 'next'
import { Button } from '@/components/ui/button'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { siteContinuationHref, type SiteActionAvailability } from '@/lib/sites/viewer-actions'

export function SiteActionContinuation({ availability, destination, action, compact = false }: {
  availability: SiteActionAvailability
  destination: string
  action: 'check' | 'copy' | 'monitoring' | 'integrations' | 'history'
  compact?: boolean
}) {
  if (availability === 'available') return null
  return <Button asChild variant="outline" size={compact ? 'sm' : 'default'} className="min-h-11" data-site-return-focus={action}>
    <Link href={siteContinuationHref(availability, destination) as Route}>
      {availability === 'claim' ? C.access.claim : C.access[action]}
    </Link>
  </Button>
}
