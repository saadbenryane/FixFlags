'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import { ANALYTICS_PREFERENCES_EVENT } from '@/lib/analytics/consent'

export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <InteractiveButton
      type="button"
      className={className}
      onClick={event => {
        event.currentTarget.focus({ preventScroll: true })
        window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT))
      }}
    >
      Cookie settings
    </InteractiveButton>
  )
}
