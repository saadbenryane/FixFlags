'use client'
import { InteractiveSelect } from '@/components/ui/interactive-controls'
import { useState } from 'react'
import type { LeadStatus } from '@prisma/client'
import { Textarea } from '@/components/ui/textarea'
import { AdminActionButton } from './AdminActionButton'
export function LeadEditor({
  domain,
  initialStatus,
  initialNotes,
}: {
  domain: string
  initialStatus: LeadStatus
  initialNotes: string | null
}) {
  const [status, setStatus] = useState(initialStatus),
    [notes, setNotes] = useState(initialNotes ?? '')
  return (
    <div className="space-y-4">
      <label className="block space-y-2 text-sm">
        Status
        <InteractiveSelect
          className="h-11 w-full rounded-input border bg-background px-3"
          value={status}
          onChange={(e) => setStatus(e.target.value as LeadStatus)}
        >
          {['NEW', 'CONTACTED', 'CONVERTED', 'DISQUALIFIED', 'QUALIFIED'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </InteractiveSelect>
      </label>
      <label htmlFor="lead-notes" className="block space-y-2 text-sm">
        Notes
        <Textarea
          id="lead-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={10000}
          rows={5}
        />
      </label>
      <AdminActionButton action="LEAD_UPDATE" targetId={domain} input={{ status, notes }} />
    </div>
  )
}
