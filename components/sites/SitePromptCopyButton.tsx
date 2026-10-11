'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { showFixPromptCopied } from './FixPromptToast'

export function SitePromptCopyButton({
  siteId,
  flagId,
  compact = false,
  iconOnly = false,
}: {
  siteId: string
  flagId: string
  compact?: boolean
  iconOnly?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [manualPrompt, setManualPrompt] = useState<string | null>(null)
  const promptRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!manualPrompt) return
    promptRef.current?.focus()
    promptRef.current?.select()
  }, [manualPrompt])

  async function copyPrompt() {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/flags/${flagId}/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copy' }),
      })
      const body = await response.json().catch(() => ({})) as { prompt?: string; message?: string; error?: string }
      if (!response.ok || !body.prompt) {
        setMessage(body.message ?? body.error ?? SITE_BOARD_COPY.copyPromptFailed)
        return
      }
      try {
        await navigator.clipboard.writeText(body.prompt)
        setCopied(true)
        showFixPromptCopied()
        setMessage(SITE_BOARD_COPY.copyPromptCopied)
        window.setTimeout(() => setCopied(false), 2000)
      } catch {
        setManualPrompt(body.prompt)
      }
    } catch {
      setMessage(SITE_BOARD_COPY.copyPromptFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <span className="inline-flex flex-col items-start">
        <Button type="button" size={iconOnly ? 'icon' : compact ? 'sm' : 'default'} variant={iconOnly ? 'ghost' : compact ? 'outline' : 'default'} disabled={busy} aria-label={iconOnly ? SITE_BOARD_COPY.copyPrompt : undefined} title={iconOnly ? SITE_BOARD_COPY.copyPrompt : undefined} onClick={() => void copyPrompt()}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {iconOnly ? null : copied ? SITE_BOARD_COPY.copyPromptCopied : SITE_BOARD_COPY.copyPrompt}
        </Button>
        {message && !copied ? <span className={iconOnly ? 'sr-only' : 'mt-2 text-sm text-muted-foreground'} role="status" aria-live="polite">{message}</span> : null}
      </span>
      <Dialog open={Boolean(manualPrompt)} onOpenChange={(open) => { if (!open) setManualPrompt(null) }}>
        <DialogContent>
          <DialogTitle>{SITE_BOARD_COPY.manualCopyTitle}</DialogTitle>
          <DialogDescription>{SITE_BOARD_COPY.manualCopyBody}</DialogDescription>
          <Textarea ref={promptRef} readOnly value={manualPrompt ?? ''} rows={12} aria-label={SITE_BOARD_COPY.fixPromptLabel} onFocus={(event) => event.currentTarget.select()} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              promptRef.current?.focus()
              promptRef.current?.select()
            }}>{SITE_BOARD_COPY.selectPrompt}</Button>
            <Button type="button" onClick={() => setManualPrompt(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
