'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface Priority {
  title: string
  rationale: string
  action: string
}

export function ExpertReviewEditor({
  orderId,
  initialSummary,
  initialPriorities,
  initialReportUrl,
  delivered,
}: {
  orderId: string
  initialSummary: string
  initialPriorities: Priority[]
  initialReportUrl: string
  delivered: boolean
}) {
  const router = useRouter()
  const [summary, setSummary] = useState(initialSummary)
  const [prioritiesText, setPrioritiesText] = useState(
    initialPriorities
      .map((item) => `${item.title}\n${item.rationale}\n${item.action}`)
      .join('\n\n---\n\n')
  )
  const [reportUrl, setReportUrl] = useState(initialReportUrl)
  const [saving, setSaving] = useState(false)
  const [delivering, setDelivering] = useState(false)

  function parsePriorities(): Priority[] {
    return prioritiesText
      .split(/\n\s*---\s*\n/)
      .map((block) => block.trim().split('\n').map((line) => line.trim()))
      .filter((lines) => lines.length >= 3)
      .map(([title, rationale, ...action]) => ({
        title,
        rationale,
        action: action.join('\n'),
      }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/expert-reviews/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          priorities: parsePriorities(),
          reportUrl: reportUrl || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.message || 'Could not save the review')
        return false
      }
      toast.success('Expert Review saved')
      router.refresh()
      return true
    } finally {
      setSaving(false)
    }
  }

  async function deliver() {
    setDelivering(true)
    try {
      const saved = await save()
      if (!saved) return
      const res = await fetch(`/api/admin/expert-reviews/${orderId}/fulfill`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.message || 'Could not deliver the review')
        return
      }
      toast.success('Expert Review delivered')
      router.refresh()
    } finally {
      setDelivering(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="review-summary" className="text-sm font-medium">Executive summary</label>
        <textarea
          id="review-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={8}
          className="w-full rounded-md border bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="review-priorities" className="text-sm font-medium">Priorities</label>
        <p className="text-xs text-muted-foreground">
          Use three lines per priority: title, rationale, action. Separate priorities with ---.
        </p>
        <textarea
          id="review-priorities"
          value={prioritiesText}
          onChange={(event) => setPrioritiesText(event.target.value)}
          rows={14}
          className="w-full rounded-md border bg-background p-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="review-report-url" className="text-sm font-medium">Supporting report URL</label>
        <Input
          id="review-report-url"
          type="url"
          value={reportUrl}
          onChange={(event) => setReportUrl(event.target.value)}
          placeholder="https://..."
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={save} disabled={saving || delivered}>
          {saving ? 'Saving…' : 'Save draft'}
        </Button>
        <Button onClick={deliver} disabled={delivering || delivered}>
          {delivered ? 'Delivered' : delivering ? 'Delivering…' : 'Deliver review'}
        </Button>
      </div>
    </div>
  )
}
