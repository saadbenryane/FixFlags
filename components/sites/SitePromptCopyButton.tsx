'use client'

import { useEffect, useRef, useState } from 'react'
import { FixPromptCard } from './FixPromptCard'
import { Check, Copy } from 'lucide-react'
import { PromptPreviewButton, PromptPreviewDialog } from '@/components/ui/prompt-preview'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { showFixPromptCopied } from './FixPromptToast'
import { useSiteAction } from '@/hooks/useSiteAction'
import { copyRepairPrompt } from '@/lib/sites/repair-prompt-client'
import { SiteActionFeedback } from './SiteActionFeedback'
import { SitePromptAccessActions } from './SiteActionContinuation'
import type { SiteActionAvailability } from '@/lib/sites/viewer-actions'
import { usePreparedRepairPrompt } from '@/hooks/usePreparedRepairPrompt'

export function SitePromptCopyButton(props: Parameters<typeof SitePromptCopyContent>[0]) {
  return <SitePromptCopyContent key={JSON.stringify([props.siteId, props.flagId, props.availability ?? 'available'])} {...props} />
}

function SitePromptCopyContent({
  siteId,
  flagId,
  flagTitle,
  compact = false,
  iconOnly = false,
  availability = 'available',
  presentation = 'button',
}: {
  siteId: string
  flagId: string
  flagTitle?: string
  compact?: boolean
  iconOnly?: boolean
  availability?: SiteActionAvailability
  presentation?: 'button' | 'preview'
}) {
  const { busy, message, error, submit } = useSiteAction()
  const [copied, setCopied] = useState(false)
  const [recordNotice, setRecordNotice] = useState<string | null>(null)
  const [manualPrompt, setManualPrompt] = useState<string | null>(null)
  const prepared = usePreparedRepairPrompt({ kind: 'flag', siteId, flagId }, availability === 'available', presentation === 'preview')
  const promptRef = useRef<HTMLTextAreaElement | null>(null)
  const copyLabel = copied ? SITE_BOARD_COPY.copyPromptCopied : SITE_BOARD_COPY.copyPrompt
  const namedCopyLabel = flagTitle ? SITE_BOARD_COPY.promptActionFor(copyLabel, flagTitle) : copyLabel
  const previewLabel = flagTitle ? SITE_BOARD_COPY.promptActionFor(SITE_BOARD_COPY.viewPrompt, flagTitle) : SITE_BOARD_COPY.viewPrompt

  useEffect(() => {
    if (!manualPrompt) return
    promptRef.current?.focus()
    promptRef.current?.select()
  }, [manualPrompt])

  async function copyPrompt() {
    await submit(async () => {
      const body = prepared.forCopy()
      setRecordNotice(null)
      const result = await copyRepairPrompt({ kind: 'flag', siteId, flagId }, body, () => {
        setCopied(true)
        showFixPromptCopied()
        window.setTimeout(() => setCopied(false), 2000)
      })
      if (!result.copied) {
        setManualPrompt(result.prompt)
        return false
      }
      setRecordNotice(result.notice)
      return true
    }, copied => copied ? SITE_BOARD_COPY.copyPromptCopied : null)
  }

  if (availability !== 'available') return <SitePromptAccessActions availability={availability}
    destination={`/sites/${siteId}/flags/${flagId}`} label={SITE_BOARD_COPY.copyPrompt} />

  return (
    <>
      {presentation === 'preview' ? <div><FixPromptCard unavailable={prepared.unavailable} prompt={prepared.preview} onCopy={() => void copyPrompt()} copied={copied} busy={busy} copyLabel={SITE_BOARD_COPY.copyPrompt} /><SiteActionFeedback message={recordNotice} error={error} siteId={siteId} /></div> : <span className="inline-flex flex-col items-start"><span className="inline-flex flex-wrap items-center gap-1">
        <Button type="button" data-site-return-focus="copy" size={iconOnly ? 'icon' : compact ? 'sm' : 'default'} variant={iconOnly ? 'ghost' : compact ? 'outline' : 'default'} loading={busy} aria-label={iconOnly || flagTitle ? namedCopyLabel : undefined} title={iconOnly ? namedCopyLabel : undefined} onClick={() => void copyPrompt()}>
          {!busy ? copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" /> : null}
          {iconOnly ? null : copyLabel}
        </Button>
        <PromptPreviewButton key={`${siteId}:${flagId}`} label={previewLabel} iconOnly={iconOnly} disabled={busy} loadPrompt={async () => {
          const body = await prepared.prepare()
          return body.prompt
        }} />
        </span>
        <SiteActionFeedback message={recordNotice ?? (!copied ? message : null)} error={error} siteId={siteId} />
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
