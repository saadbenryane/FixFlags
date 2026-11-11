'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { PromptPreviewButton, PromptPreviewDialog } from '@/components/ui/prompt-preview'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { SITE_BOARD_COPY as B } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { copyRepairPrompt, downloadRepairFile, type RepairPromptScope } from '@/lib/sites/repair-prompt-client'
import { AGENT_HANDOFF_COPY as H } from '@/lib/marketing/copy/agent-handoff'
import { MAX_REPAIR_TASKS } from '@/lib/sites/repair-scope'
import type { SiteActionAvailability } from '@/lib/sites/viewer-actions'
import { useSiteAction } from '@/hooks/useSiteAction'
import { usePreparedRepairPrompt } from '@/hooks/usePreparedRepairPrompt'
import { FixPromptCard } from './FixPromptCard'
import { showFixPromptCopied } from './FixPromptToast'
import { SiteActionFeedback } from './SiteActionFeedback'
import { SitePromptAccessActions } from './SiteActionContinuation'

type Props = {
  scope: RepairPromptScope; availability: SiteActionAvailability; label?: string; flagTitle?: string;
  compact?: boolean; iconOnly?: boolean; presentation?: 'button' | 'preview';
  /** A view holds one primary button; this copy action yields that weight to another. */
  secondary?: boolean;
  /** Offer the preview beside the copy button. Off where the view already opens the full Flag. */
  preview?: boolean;
  /** After a successful copy, show exactly what was copied instead of offering a separate preview. */
  reveal?: boolean;
}

/** One owner for inspected instructions, native copying, receipts, and recovery. */
export function SiteRepairPrompt(props: Props) {
  return <RepairPromptContent key={JSON.stringify([props.scope, props.availability])} {...props} />
}

function RepairPromptContent({ scope, availability, label, flagTitle, compact = false, iconOnly = false, presentation = 'button', secondary = false, preview = true, reveal = false }: Props) {
  const { siteId } = scope
  const isFlag = scope.kind === 'flag'
  const { busy, message, error, submit } = useSiteAction()
  const [copied, setCopied] = useState(false)
  const [recordNotice, setRecordNotice] = useState<string | null>(null)
  const [manual, setManual] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [manualState, setManualState] = useState<'idle' | 'copied' | 'keys'>('idle')
  async function copyManually() {
    input.current?.focus(); input.current?.select()
    try {
      await navigator.clipboard.writeText(manual ?? '')
      setManualState('copied')
      window.setTimeout(() => { setManual(null); setManualState('idle') }, 900)
    } catch { setManualState('keys') }
  }
  const input = useRef<HTMLTextAreaElement>(null)
  const scopeTooLarge = scope.kind === 'bundle' && Boolean(scope.flagIds && scope.flagIds.length > MAX_REPAIR_TASKS)
  const scopeNotice = scopeTooLarge ? C.bundleTooLarge(MAX_REPAIR_TASKS) : null
  const prepared = usePreparedRepairPrompt(scope, availability === 'available' && !scopeTooLarge, presentation === 'preview')
  const copyLabel = isFlag ? B.copyPrompt : label ?? (scope.flagIds ? C.fixSelected(scope.flagIds.length) : scope.area ? C.fixCategory : C.fixAll)
  const copiedLabel = isFlag ? B.copyPromptCopied : C.bundleCopied
  const currentLabel = downloading ? H.fileDownloading : copied ? copiedLabel : !isFlag && busy ? C.bundlePreparing : copyLabel
  const namedLabel = flagTitle ? B.promptActionFor(currentLabel, flagTitle) : currentLabel
  const previewLabel = flagTitle ? B.promptActionFor(B.viewPrompt, flagTitle) : B.viewPrompt

  useEffect(() => {
    if (!copied || busy) return
    const timer = window.setTimeout(() => setCopied(false), isFlag ? 2000 : 2500)
    return () => window.clearTimeout(timer)
  }, [copied, busy, isFlag])

  async function copy() {
    if (scopeTooLarge) return
    await submit(async signal => {
      setCopied(false)
      const body = prepared.forDelivery()
      setRecordNotice(null)
      const result = await copyRepairPrompt(scope, body, () => {
        if (signal.aborted) return
        setCopied(true)
        if (isFlag) showFixPromptCopied()
      })
      if (signal.aborted) return false
      if (!result.copied) { setManual(result.prompt); return false }
      setRecordNotice(result.notice)
      if (reveal) setRevealed((await body).prompt)
      return true
    }, saved => isFlag && saved ? B.copyPromptCopied : null)
  }

  async function download() {
    setDownloading(true); setRecordNotice(null)
    try {
      await submit(async signal => {
        const task = await prepared.forDelivery()
        await downloadRepairFile(scope, task, signal)
        return true
      }, () => H.fileReady)
    } finally { setDownloading(false) }
  }

  if (availability !== 'available') return <SitePromptAccessActions availability={availability}
    destination={isFlag ? `/sites/${siteId}/flags/${scope.flagId}` : `/sites/${siteId}${scope.area ? `?category=${scope.area}` : ''}`} label={copyLabel} />

  const feedback = <SiteActionFeedback message={recordNotice ?? scopeNotice ?? (message === H.fileReady || isFlag && presentation === 'button' && !copied ? message : null)} error={error} siteId={siteId} />
  return <>
    {presentation === 'preview' ? <div className={isFlag ? undefined : 'w-full'}>
      <FixPromptCard openInCursor unavailable={scopeNotice ?? prepared.unavailable} prompt={prepared.preview} busy={busy} disabled={scopeTooLarge} copied={copied} copyLabel={downloading ? H.fileDownloading : copyLabel} copiedLabel={copiedLabel} onCopy={() => void copy()}
        onDownload={() => void download()} downloadLabel={H.fileDownload}
        onExpand={() => { if (!scopeTooLarge && !prepared.preview) void submit(() => prepared.prepare(), () => null) }} />
      {feedback}
    </div> : <span className={`inline-flex flex-col items-start${isFlag ? '' : ' gap-2'}`}>
      <span className="inline-flex flex-wrap items-center gap-1">
        {/* Row copy actions stay visible but quiet; the view's primary actions keep their weight. */}
        <Button type="button" data-site-return-focus="copy" size={isFlag ? iconOnly ? 'icon' : compact ? 'sm' : 'default' : 'sm'}
          variant={isFlag ? iconOnly || compact ? 'ghost' : secondary ? 'outline' : 'default' : scope.area || secondary ? 'outline' : 'default'}
          disabled={busy || scopeTooLarge} loading={isFlag && busy && !copied} loadingLabel={downloading ? H.fileDownloading : undefined} aria-busy={busy || undefined}
          aria-label={iconOnly || flagTitle ? namedLabel : undefined} title={isFlag ? iconOnly ? namedLabel : undefined : C.bundleBody} onClick={() => void copy()}>
          {copied ? <Check aria-hidden /> : !isFlag || !busy ? <Copy aria-hidden /> : null}{iconOnly ? null : currentLabel}
        </Button>
        {/* A bundle keeps one labelled button; its preview rides along as an icon. */}
        {preview && !reveal ? <PromptPreviewButton label={previewLabel} iconOnly={iconOnly || !isFlag} disabled={busy || scopeTooLarge} onCopy={() => void copy()} copyLabel={copyLabel}
          onDownload={() => void download()} downloadLabel={H.fileDownload}
          loadPrompt={async () => (await prepared.prepare()).prompt} /> : null}
      </span>
      {feedback}
    </span>}
    {reveal ? <PromptPreviewDialog prompt={revealed ?? ''} open={revealed !== null} onOpenChange={open => { if (!open) setRevealed(null) }}
      heading={C.copiedReveal.title} description={C.copiedReveal.body} doneLabel={C.copiedReveal.done}
      onDownload={() => void download()} downloadLabel={C.copiedReveal.download} /> : null}
    <PromptPreviewDialog prompt={prepared.review ?? ''} open={prepared.review !== null} onOpenChange={open => { if (!open) prepared.closeReview() }}
      onDownload={() => void download()} downloadLabel={H.fileDownload}
      onCopy={() => void copy()} copyLabel={copyLabel} copyDisabled={busy || scopeTooLarge} description={C.promptChanged} />
    <Dialog open={Boolean(manual)} onOpenChange={open => { if (!open) { setManual(null); setManualState('idle') } }}>
      <DialogContent header={<DialogTitle>{isFlag ? B.manualCopyTitle : C.bundleManual}</DialogTitle>} onOpenAutoFocus={event => {
        if (!input.current) return
        event.preventDefault(); input.current.focus(); input.current.select()
      }}>
        <DialogDescription>{B.manualCopyBody}</DialogDescription>
        <Textarea ref={input} value={manual ?? ''} readOnly rows={isFlag ? 12 : 14} aria-label={B.fixPromptLabel} onFocus={event => event.currentTarget.select()} />
        {manualState === 'keys' ? <p role="status" className="text-sm text-muted-foreground">{B.manualCopyKeys}</p> : null}
        <DialogFooter>
          {/* A click is a fresh gesture, so the browser often allows the copy it refused before. */}
          <Button type="button" onClick={() => void copyManually()}>{manualState === 'copied' ? <Check aria-hidden /> : <Copy aria-hidden />}{manualState === 'copied' ? B.manualCopyDone : B.manualCopyAction}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
