'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Copy, Eye } from 'lucide-react'
import { Button } from './button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from './dialog'
import { Textarea } from './textarea'
import { SITE_BOARD_COPY as C } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { SYSTEM_COPY } from '@/lib/marketing/copy/errors'

export function PromptPreviewButton({ prompt, loadPrompt, disabled, iconOnly = false, onLockedAction, label = C.viewPrompt, onCopy, copyLabel, onDownload, downloadLabel }: {
  prompt?: string; loadPrompt?: () => Promise<string>; disabled?: boolean; iconOnly?: boolean; onLockedAction?: () => void;
  label?: string;
  onCopy?: () => void; copyLabel?: string;
  onDownload?: () => void; downloadLabel?: string;
}) {
  const [preview, setPreview] = useState<{ prompt: string; loading: boolean; error: string | null } | null>(null)
  const pending = useRef<object | null>(null)
  useLayoutEffect(() => () => { pending.current = null }, [])
  async function show() {
    if (onLockedAction) { onLockedAction(); return }
    if (pending.current) return
    const request = {}
    pending.current = request
    setPreview({ prompt: '', loading: true, error: null })
    try {
      const text = loadPrompt ? await loadPrompt() : prompt
      if (!text?.trim()) throw new Error(C.copyPromptFailed)
      if (pending.current === request) setPreview({ prompt: text, loading: false, error: null })
    } catch (failure) {
      if (pending.current === request) setPreview({ prompt: '', loading: false, error: failure instanceof Error ? failure.message : C.copyPromptFailed })
    } finally { if (pending.current === request) pending.current = null }
  }
  const loading = preview?.loading ?? false
  return <>
    <Button type="button" variant="ghost" size={iconOnly ? 'icon' : 'sm'} disabled={disabled} loading={loading} aria-label={label} title={label} onClick={() => void show()}>{!loading ? <Eye size={15} aria-hidden /> : null}{!iconOnly ? C.viewPrompt : null}</Button>
    <PromptPreviewDialog prompt={preview?.prompt ?? ''} open={preview !== null} onOpenChange={open => {
      if (!open) { pending.current = null; setPreview(null) }
    }} loading={loading} error={preview?.error} onRetry={() => void show()} onCopy={onCopy} copyLabel={copyLabel} copyDisabled={disabled} onDownload={onDownload} downloadLabel={downloadLabel} />
  </>
}

export function PromptPreviewDialog({ prompt, open, onOpenChange, onCopy, copyLabel = C.copyPrompt, copyDisabled, description = C.previewPromptBody, loading = false, error, onRetry, onDownload, downloadLabel, heading = C.fixPromptLabel, doneLabel }: {
  prompt: string; open: boolean; onOpenChange: (open: boolean) => void;
  onCopy?: () => void; copyLabel?: string; copyDisabled?: boolean; description?: string;
  loading?: boolean; error?: string | null; onRetry?: () => void;
  onDownload?: () => void; downloadLabel?: string;
  /** A confirmation after copying: its own heading, a single Done, and no select or copy controls. */
  heading?: string; doneLabel?: string;
}) {
  const input = useRef<HTMLTextAreaElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const ready = !loading && !error && Boolean(prompt.trim())
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent header={<DialogTitle ref={title}>{heading}</DialogTitle>} initialFocus="title" className="max-w-3xl">
      <DialogDescription>{description}</DialogDescription>
      {loading ? <p role="status" className="min-h-40 text-sm text-muted-foreground">{SITE_DASHBOARD_COPY.promptLoading}</p>
        : error ? <div className="min-h-40 space-y-3"><p role="alert" className="text-sm text-destructive">{error}</p>
          {onRetry ? <Button type="button" variant="outline" onClick={() => { title.current?.focus({ preventScroll: true }); onRetry() }}>{SYSTEM_COPY.actions.retry}</Button> : null}</div>
        : <Textarea ref={input} readOnly value={prompt} rows={14} aria-label={C.fixPromptLabel} className="font-mono text-xs leading-relaxed" />}
      {doneLabel ? <DialogFooter>
        {onDownload ? <Button type="button" variant="ghost" disabled={!ready} onClick={() => { onOpenChange(false); onDownload() }}>{downloadLabel}</Button> : null}
        <Button type="button" onClick={() => onOpenChange(false)}>{doneLabel}</Button>
      </DialogFooter> : <DialogFooter>
        {onDownload ? <Button type="button" variant="outline" disabled={copyDisabled || !ready} onClick={() => { onOpenChange(false); onDownload() }}>{downloadLabel}</Button> : null}
        <Button type="button" variant="outline" disabled={!ready} onClick={() => { input.current?.focus(); input.current?.select() }}>{C.selectPrompt}</Button>
        {onCopy ? <Button type="button" disabled={copyDisabled || !ready} onClick={() => { onOpenChange(false); onCopy() }}><Copy aria-hidden />{copyLabel}</Button> : null}
      </DialogFooter>}
    </DialogContent>
  </Dialog>
}
