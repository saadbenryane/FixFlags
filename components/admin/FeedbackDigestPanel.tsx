'use client'
import { useState } from 'react'
import { AdminActionButton } from './AdminActionButton'
export function FeedbackDigestPanel() {
  const [days, setDays] = useState(30)
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Export all feedback in the selected window. Structured identifiers are omitted. Email
        addresses, URLs, and credential patterns are redacted.
      </p>
      <label className="block space-y-2 text-sm">
        Window
        <select
          className="h-11 rounded-input border bg-background px-3"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {[7, 30, 90, 365].map((n) => (
            <option key={n} value={n}>
              {n} days
            </option>
          ))}
        </select>
      </label>
      <AdminActionButton action="DATA_EXPORT" targetId="feedback" input={{ days }} />
    </div>
  )
}
