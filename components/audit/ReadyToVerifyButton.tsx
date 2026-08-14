'use client'

import { useId, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const summaryId = useId()
  const deploymentId = useId()
  const summaryErrorId = useId()

  async function submit() {
    const changeSummary = summary.trim()
    if (!changeSummary) {
      const message = 'Describe the implemented change'
      setSummaryError(message)
      toast.error(message)
      return
    }
    setSummaryError(null)
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
        <form noValidate onSubmit={(event) => { event.preventDefault(); void submit() }} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor={summaryId}>What changed?</Label>
            <Textarea
              id={summaryId}
              value={summary}
              onChange={(event) => {
                setSummary(event.target.value)
                if (event.target.value.trim()) setSummaryError(null)
              }}
              maxLength={2000}
              required
              aria-invalid={Boolean(summaryError)}
              aria-describedby={summaryError ? summaryErrorId : undefined}
              placeholder="Restored the signup action and preserved existing account access."
            />
            {summaryError ? <p id={summaryErrorId} role="alert" className="text-xs text-destructive">{summaryError}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={deploymentId}>
              Deployment reference <span className="font-normal text-muted-foreground">Optional</span>
            </Label>
            <Input
              id={deploymentId}
              value={deployment}
              onChange={(event) => setDeployment(event.target.value)}
              maxLength={500}
              placeholder="Commit, pull request, or deployment URL"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" aria-hidden />}
              Mark ready
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
