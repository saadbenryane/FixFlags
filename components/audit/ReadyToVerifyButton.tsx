'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function ReadyToVerifyButton({
  flagId,
  builder,
  compact = false,
}: {
  flagId: string
  builder: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState('')
  const [deployment, setDeployment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    const changeSummary = summary.trim()
    if (!changeSummary) {
      toast.error('Describe the implemented change')
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch(`/api/flags/${flagId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          builder,
          action: 'READY_TO_VERIFY',
          changeSummary,
          deploymentReference: deployment.trim() || undefined,
        }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(result?.error || 'Could not record the change')
      setOpen(false)
      setSummary('')
      setDeployment('')
      toast.success('Change ready to verify', {
        description: 'Run an update Review after the change is live.',
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not record the change')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size={compact ? 'xs' : 'sm'}>
          <CheckCircle2 aria-hidden />
          Ready to verify
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark the implemented change ready to verify</DialogTitle>
          <DialogDescription>
            This records your change, not a successful result. A fresh update Review decides whether it worked.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2 text-sm font-medium">
            What changed?
            <Textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={2000}
              required
              placeholder="Restored the signup action and preserved existing account access."
            />
          </div>
          <div className="grid gap-2 text-sm font-medium">
            Deployment reference <span className="font-normal text-muted-foreground">Optional</span>
            <Input
              value={deployment}
              onChange={(event) => setDeployment(event.target.value)}
              maxLength={500}
              placeholder="Commit, pull request, or deployment URL"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={submitting || !summary.trim()}>
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            Mark ready
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
