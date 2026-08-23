'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { REPORT_COPY } from '@/lib/marketing/copy'

export function KeepReportEmail({ auditId }: { auditId: string }) {
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

  if (saved) {
    return (
      <div className="rounded-card border border-border/50 bg-muted/15 p-5">
        <p className="text-sm font-semibold">{REPORT_COPY.keepReport.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{REPORT_COPY.keepReport.saved}</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-card border border-border/50 bg-muted/15 p-5"
    >
      <div>
        <p className="text-sm font-semibold">{REPORT_COPY.keepReport.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{REPORT_COPY.keepReport.helper}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
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
        <Button type="submit" loading={busy} loadingLabel={REPORT_COPY.keepReport.saving}>
          {REPORT_COPY.keepReport.action}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
