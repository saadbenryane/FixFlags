'use client'

import { useEffect, useRef, useState } from 'react'
import { FixPromptCard } from './FixPromptCard'
import { Check, Copy } from 'lucide-react'
import { PromptPreviewButton, PromptPreviewDialog } from '@/components/ui/prompt-preview'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { REPORT_COPY } from '@/lib/marketing/copy/report-workspace'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { showFixPromptCopied } from './FixPromptToast'
import { useSiteAction } from '@/hooks/useSiteAction'
import { executeSiteAction, SiteActionError } from '@/lib/sites/client-actions'
import { SiteActionFeedback } from './SiteActionFeedback'
import { SitePromptAccessActions } from './SiteActionContinuation'
import type { SiteActionAvailability } from '@/lib/sites/viewer-actions'
import { usePreparedRepairPrompt } from '@/hooks/usePreparedRepairPrompt'

export function SitePromptCopyButton({
  siteId,
  flagId,
  compact = false,
  iconOnly = false,
  availability = 'available',
  presentation = 'button',
}: {
  siteId: string
  flagId: string
  compact?: boolean
  iconOnly?: boolean
  availability?: SiteActionAvailability
  presentation?: 'button' | 'preview'
}) {
  const { busy, message, error, submit } = useSiteAction()
  const [copied, setCopied] = useState(false)
  const [manualPrompt, setManualPrompt] = useState<string | null>(null)
  const prepared = usePreparedRepairPrompt({ kind: 'flag', siteId, flagId }, availability === 'available', presentation === 'preview')
  const promptRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!manualPrompt) return
    promptRef.current?.focus()
    promptRef.current?.select()
  }, [manualPrompt])

  async function copyPrompt() {
    await submit(async () => {
      const body = await prepared.forCopy()
      const task = body.tasks[0]
      try {
        await navigator.clipboard.writeText(body.prompt)
      } catch {
        setManualPrompt(body.prompt)
        return false
      }
      try {
        await executeSiteAction(`/api/sites/${siteId}/flags/${encodeURIComponent(task.sourceFlagId)}/fix`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'copy', promptHash: task.promptHash }),
        }, 'fixPrompt')
      } catch (failure) {
        const message = failure instanceof SiteActionError && failure.code === 'REPAIR_TASK_CHANGED'
          ? `${REPORT_COPY.explorer.promptCopiedRecordFailed}. ${SITE_ACTION_COPY.repairGuidance.changed}`
          : REPORT_COPY.explorer.promptCopiedRecordFailed
        throw new SiteActionError(message,
          failure instanceof SiteActionError ? failure.status : undefined,
          failure instanceof SiteActionError ? failure.code : undefined)
      }
      setCopied(true)
      showFixPromptCopied()
      window.setTimeout(() => setCopied(false), 2000)
      return true
    }, copied => copied ? SITE_BOARD_COPY.copyPromptCopied : null)
  }

  if (availability !== 'available') return <SitePromptAccessActions availability={availability}
    destination={`/sites/${siteId}/flags/${flagId}`} label={SITE_BOARD_COPY.copyPrompt} />

  return (
    <>
      {presentation === 'preview' ? <div><FixPromptCard unavailable={prepared.unavailable} prompt={prepared.preview} onCopy={() => void copyPrompt()} copied={copied} busy={busy} copyLabel={SITE_BOARD_COPY.copyPrompt} /><SiteActionFeedback message={null} error={error} siteId={siteId} /></div> : <span className="inline-flex flex-col items-start"><span className="inline-flex flex-wrap items-center gap-1">
        <Button type="button" data-site-return-focus="copy" size={iconOnly ? 'icon' : compact ? 'sm' : 'default'} variant={iconOnly ? 'ghost' : compact ? 'outline' : 'default'} disabled={busy} aria-label={iconOnly ? SITE_BOARD_COPY.copyPrompt : undefined} title={iconOnly ? SITE_BOARD_COPY.copyPrompt : undefined} onClick={() => void copyPrompt()}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {iconOnly ? null : copied ? SITE_BOARD_COPY.copyPromptCopied : SITE_BOARD_COPY.copyPrompt}
        </Button>
        <PromptPreviewButton key={`${siteId}:${flagId}`} iconOnly={iconOnly} disabled={busy} loadPrompt={async () => {
          const body = await prepared.prepare()
          return body.prompt
        }} />
        </span>
        {!copied ? <SiteActionFeedback message={message} error={error} siteId={siteId} /> : null}
      </span>}
      <PromptPreviewDialog prompt={prepared.review ?? ''} open={prepared.review !== null} onOpenChange={open => { if (!open) prepared.closeReview() }} />
      <Dialog open={Boolean(manualPrompt)} onOpenChange={(open) => { if (!open) setManualPrompt(null) }}>
        <DialogContent header={<DialogTitle>{SITE_BOARD_COPY.manualCopyTitle}</DialogTitle>}>
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
