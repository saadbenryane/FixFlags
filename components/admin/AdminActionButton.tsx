'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ADMIN_COPY } from '@/lib/marketing/copy/admin'
import type { AdminAction, AdminActionPreview, AdminOperationReceipt } from '@/lib/admin/contracts'

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok)
    throw new Error(data.error?.message ?? data.error ?? 'The request could not be completed.')
  return data as T
}
export function AdminActionButton({
  action,
  targetId,
  input = {},
  label,
  onCompleted,
}: {
  action: AdminAction
  targetId: string
  input?: Record<string, unknown>
  label?: string
  onCompleted?: () => void
}) {
  const router = useRouter(),
    id = useId()
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState('')
  const [preview, setPreview] = useState<AdminActionPreview | null>(null)
  const [receipt, setReceipt] = useState<AdminOperationReceipt | null>(null)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null)
  const key = useRef<string | null>(null)
  useEffect(() => {
    if (!open || !receipt || !['QUEUED', 'RUNNING'].includes(receipt.status)) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const next = await readResponse<AdminOperationReceipt>(
          await fetch(`/api/admin/actions/${receipt.id}`, { signal: controller.signal }),
        )
        setReceipt(next)
        if (next.status === 'SUCCEEDED') {
          router.refresh()
          onCompleted?.()
        }
      } catch (err) {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Could not refresh the action.')
      }
    }, 1500)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [receipt, open, router, onCompleted])
  async function review() {
    setBusy(true)
    setError(null)
    try {
      setPreview(
        await readResponse<AdminActionPreview>(
          await fetch('/api/admin/actions/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, targetId, input, reason }),
          }),
        ),
      )
      key.current = crypto.randomUUID()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not preview the action.')
    } finally {
      setBusy(false)
    }
  }
  async function confirm() {
    if (!preview || !key.current) return
    setBusy(true)
    setError(null)
    try {
      const result = await readResponse<AdminOperationReceipt>(
        await fetch('/api/admin/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: preview.intent, idempotencyKey: key.current }),
        }),
      )
      setReceipt(result)
      if (result.status === 'SUCCEEDED') {
        router.refresh()
        onCompleted?.()
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not confirm the action. Retry with the same request.',
      )
    } finally {
      setBusy(false)
    }
  }
  const result = receipt?.result as {
    downloadUrl?: string
    grantId?: string
    expiresAt?: string
    joinUrl?: string
    state?: string
    auditId?: string
    outcome?: string
    shopId?: string
    effectiveAt?: string
  } | null
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true)
          if (!receipt || !['QUEUED', 'RUNNING', 'INDETERMINATE'].includes(receipt.status)) {
            setPreview(null)
            setReceipt(null)
            setReason('')
            setError(null)
          }
        }}
      >
        {label ?? ADMIN_COPY.actions[action]}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent header={<DialogTitle>{preview?.title ?? ADMIN_COPY.actions[action]}</DialogTitle>} className="max-h-[90dvh]">
          <DialogDescription>
            {preview?.targetLabel ?? 'Every action is recorded with your identity and reason.'}
          </DialogDescription>
          {!receipt && !preview && (
            <>
              <label htmlFor={id} className="text-sm font-medium">
                {ADMIN_COPY.reasonLabel}
              </label>
              <Textarea
                id={id}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
              />
              <Button disabled={busy || reason.trim().length < 5} onClick={() => void review()}>
                {busy ? 'Reviewing…' : ADMIN_COPY.preview}
              </Button>
            </>
          )}
          {!receipt && preview && (
            <>
              <ul className="space-y-2 text-sm">
                {preview.effects.map((effect) => (
                  <li key={effect}>{effect}</li>
                ))}
              </ul>
              {preview.recentAuthenticationRequired && (
                <p className="text-sm text-muted-foreground">
                  Confirmation requires a session created within the last five minutes. Sign out and
                  sign in again if requested.
                </p>
              )}
              <Button
                disabled={busy || Date.parse(preview.expiresAt) <= Date.now()}
                variant={preview.destructive ? 'destructive' : 'default'}
                onClick={() => void confirm()}
              >
                {busy ? 'Confirming…' : ADMIN_COPY.confirm}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setPreview(null)}>
                Edit reason
              </Button>
            </>
          )}
          {receipt && (
            <div role="status" className="space-y-3">
              <p className="font-medium">{ADMIN_COPY.statuses[receipt.status]}</p>
              {result?.state === 'QUEUED' && (
                <p className="text-sm">
                  The work is queued. Inspect its recorded execution for the completed result.
                </p>
              )}
              {result?.shopId && (
                <Link className="text-sm underline" href={`/admin/shops/${result.shopId}`}>
                  Open installation
                </Link>
              )}
              {result?.effectiveAt && (
                <p className="text-sm">
                  Scheduled for{' '}
                  {new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Africa/Casablanca',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(result.effectiveAt))}
                  .
                </p>
              )}
              {result?.state === 'ADMITTED' && (
                <p className="text-sm">
                  The check was admitted. Follow its execution for the completed result.
                </p>
              )}
              {result?.auditId && (
                <Link className="text-sm underline" href={`/admin/audits/${result.auditId}`}>
                  Open check
                </Link>
              )}
              {result?.outcome === 'INDETERMINATE' && (
                <p className="text-sm">
                  The original outcome is still unconfirmed. Recorded evidence did not establish
                  completion.
                </p>
              )}
              {receipt.errorMessage && <p>{receipt.errorMessage}</p>}
              {receipt.status === 'INDETERMINATE' && (
                <p className="text-sm">
                  Inspect the provider and recorded outcome before requesting another action.
                </p>
              )}
              {result?.downloadUrl && (
                <a className="underline" href={result.downloadUrl}>
                  Download authorized export
                </a>
              )}
              {action === 'EVIDENCE_ACCESS' && result?.grantId && (
                <Link className="underline" href={`/admin/evidence/${result.grantId}`}>
                  Open private evidence
                </Link>
              )}
              {result?.joinUrl && (
                <a className="underline break-all" href={result.joinUrl}>
                  Open invite
                </a>
              )}
              <Link
                className="block text-sm underline"
                href={`/admin/activity?operation=${receipt.id}`}
              >
                View recorded activity
              </Link>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
