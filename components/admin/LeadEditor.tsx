'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { LeadStatus } from '@prisma/client'

const STATUSES: LeadStatus[] = ['NEW', 'QUALIFIED', 'CONTACTED', 'CONVERTED', 'DISQUALIFIED']

interface LeadEditorProps {
  domain: string
  initialStatus: LeadStatus
  initialNotes: string | null
}

export function LeadEditor({ domain, initialStatus, initialNotes }: LeadEditorProps) {
  const [status, setStatus] = useState(initialStatus)
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/leads/${encodeURIComponent(domain)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      })
      if (res.ok) {
        toast.success('Lead updated')
      } else {
        toast.error('Failed to update lead')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="lead-status" className="text-sm font-medium">
          Status
        </label>
        <select
          id="lead-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as LeadStatus)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="lead-notes" className="text-sm font-medium">
          Notes
        </label>
        <textarea
          id="lead-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Outbound notes, context, next steps…"
        />
      </div>

      <Button onClick={() => void save()} disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  )
}
