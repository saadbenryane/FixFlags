'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { REPORT_COPY } from '@/lib/marketing/copy'

export function KeepReportEmail({
  auditId,
  open,
  onOpenChange,
}: {
  auditId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/reports/${auditId}/keep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        setError(payload?.message ?? REPORT_COPY.keepReport.error)
        return
      }
      setSaved(true)
    } catch {
      setError(REPORT_COPY.keepReport.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{REPORT_COPY.keepReport.title}</DialogTitle>
          <DialogDescription>
            {saved ? REPORT_COPY.keepReport.saved : REPORT_COPY.keepReport.helper}
          </DialogDescription>
        </DialogHeader>
        {saved ? null : (
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="sr-only" htmlFor={`keep-report-email-${auditId}`}>
              {REPORT_COPY.keepReport.emailLabel}
            </label>
            <Input
              id={`keep-report-email-${auditId}`}
              type="email"
              required
              autoComplete="email"
              placeholder={REPORT_COPY.keepReport.emailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button
              type="submit"
              className="w-full"
              loading={busy}
              loadingLabel={REPORT_COPY.keepReport.saving}
            >
              {REPORT_COPY.keepReport.action}
            </Button>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
