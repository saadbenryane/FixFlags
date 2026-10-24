'use client'

import { useRef, useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from './button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from './dialog'
import { Textarea } from './textarea'
import { SITE_BOARD_COPY as C } from '@/lib/marketing/copy/terminology'

export function PromptPreviewButton({ prompt, loadPrompt, disabled, iconOnly = false, onLockedAction }: {
  prompt?: string; loadPrompt?: () => Promise<string>; disabled?: boolean; iconOnly?: boolean; onLockedAction?: () => void;
}) {
  const [visible, setVisible] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  async function show() {
    if (onLockedAction) { onLockedAction(); return }
    if (pending.current) return
    pending.current = true; setLoading(true); setError(null)
    try {
      const text = loadPrompt ? await loadPrompt() : prompt
      if (!text?.trim()) throw new Error(C.copyPromptFailed)
      setVisible(text)
    } catch (failure) { setError(failure instanceof Error ? failure.message : C.copyPromptFailed) }
    finally { pending.current = false; setLoading(false) }
  }
  return <>
    <Button type="button" variant="ghost" size={iconOnly ? 'icon' : 'sm'} disabled={disabled || loading} aria-label={C.viewPrompt} title={C.viewPrompt} onClick={() => void show()}><Eye size={15} aria-hidden />{!iconOnly ? C.viewPrompt : null}</Button>
    {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
    <PromptPreviewDialog prompt={visible ?? ''} open={visible !== null} onOpenChange={open => { if (!open) setVisible(null) }} />
  </>
}

export function PromptPreviewDialog({ prompt, open, onOpenChange }: { prompt: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const input = useRef<HTMLTextAreaElement>(null)
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent header={<DialogTitle>{C.fixPromptLabel}</DialogTitle>} className="max-w-3xl">
      <DialogDescription>{C.previewPromptBody}</DialogDescription>
      <Textarea ref={input} readOnly value={prompt} rows={14} aria-label={C.fixPromptLabel} className="font-mono text-xs leading-relaxed" />
      <DialogFooter><Button type="button" variant="outline" onClick={() => { input.current?.focus(); input.current?.select() }}>{C.selectPrompt}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
