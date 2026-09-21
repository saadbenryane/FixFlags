'use client'

import { ANALYTICS_PREFERENCES_EVENT } from '@/lib/analytics/consent'

export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT))}
    >
      Cookie settings
    </button>
  )
}
