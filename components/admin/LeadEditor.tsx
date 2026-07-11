'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as LeadStatus)}
        >
          <SelectTrigger id="lead-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label htmlFor="lead-notes" className="text-sm font-medium">
          Notes
        </label>
        <Textarea
          id="lead-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Outbound notes, context, next steps…"
        />
      </div>

      <Button onClick={() => void save()} disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  )
}
