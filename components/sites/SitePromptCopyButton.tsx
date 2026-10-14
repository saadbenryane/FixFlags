'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { showFixPromptCopied } from './FixPromptToast'
import { useSiteAction } from '@/hooks/useSiteAction'
import { executeSiteAction } from '@/lib/sites/client-actions'
import { SiteActionFeedback } from './SiteActionFeedback'
import { SiteActionContinuation } from './SiteActionContinuation'
import type { SiteActionAvailability } from '@/lib/sites/viewer-actions'

export function SitePromptCopyButton({
  siteId,
  flagId,
  compact = false,
  iconOnly = false,
  availability = 'available',
}: {
  siteId: string
  flagId: string
  compact?: boolean
  iconOnly?: boolean
  availability?: SiteActionAvailability
}) {
  const { busy, message, error, submit } = useSiteAction()
  const [copied, setCopied] = useState(false)
  const [manualPrompt, setManualPrompt] = useState<string | null>(null)
  const promptRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!manualPrompt) return
    promptRef.current?.focus()
    promptRef.current?.select()
  }, [manualPrompt])

  async function copyPrompt() {
    await submit(async () => {
      const body = await executeSiteAction(`/api/sites/${siteId}/flags/${flagId}/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copy' }),
      }, 'fixPrompt')
      try {
        await navigator.clipboard.writeText(body.prompt)
        setCopied(true)
        showFixPromptCopied()
        window.setTimeout(() => setCopied(false), 2000)
        return true
      } catch {
        setManualPrompt(body.prompt)
        return false
      }
    }, copied => copied ? SITE_BOARD_COPY.copyPromptCopied : null)
  }

  if (availability !== 'available') return <SiteActionContinuation availability={availability}
    destination={`/sites/${siteId}/flags/${flagId}`} action="copy" compact />

  return (
    <>
      <span className="inline-flex flex-col items-start">
        <Button type="button" size={iconOnly ? 'icon' : compact ? 'sm' : 'default'} variant={iconOnly ? 'ghost' : compact ? 'outline' : 'default'} disabled={busy} aria-label={iconOnly ? SITE_BOARD_COPY.copyPrompt : undefined} title={iconOnly ? SITE_BOARD_COPY.copyPrompt : undefined} onClick={() => void copyPrompt()}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {iconOnly ? null : copied ? SITE_BOARD_COPY.copyPromptCopied : SITE_BOARD_COPY.copyPrompt}
        </Button>
        {!copied ? <SiteActionFeedback message={message} error={error} siteId={siteId} /> : null}
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
