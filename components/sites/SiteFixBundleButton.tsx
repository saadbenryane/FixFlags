'use client'

import { useRef, useState } from 'react'
import { FixPromptCard } from './FixPromptCard'
import { Check, Copy } from 'lucide-react'
import { PromptPreviewButton, PromptPreviewDialog } from '@/components/ui/prompt-preview'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import type { SiteActionAvailability } from '@/lib/sites/viewer-actions'
import { copyRepairPrompt } from '@/lib/sites/repair-prompt-client'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { useSiteAction } from '@/hooks/useSiteAction'
import { SitePromptAccessActions } from './SiteActionContinuation'
import { SiteActionFeedback } from './SiteActionFeedback'
import { usePreparedRepairPrompt } from '@/hooks/usePreparedRepairPrompt'
import { MAX_REPAIR_TASKS } from '@/lib/sites/repair-scope'

export function SiteFixBundleButton(props: Parameters<typeof SiteFixBundleContent>[0]) {
  return <SiteFixBundleContent key={JSON.stringify([props.siteId, props.area, props.flagIds, props.availability])} {...props} />
}

function SiteFixBundleContent({ siteId, area, flagIds, availability, presentation = 'button' }: { siteId: string; area?: SiteCardArea; flagIds?: string[]; availability: SiteActionAvailability; presentation?: 'button' | 'preview' }) {
  const { busy, error, submit } = useSiteAction()
  const [copied, setCopied] = useState(false)
  const [manual, setManual] = useState<string | null>(null)
  const scopeTooLarge = Boolean(flagIds && flagIds.length > MAX_REPAIR_TASKS)
  const scopeNotice = scopeTooLarge ? C.bundleTooLarge(MAX_REPAIR_TASKS) : null
  const prepared = usePreparedRepairPrompt({ kind: 'bundle', siteId, ...(area ? { area } : {}), ...(flagIds ? { flagIds } : {}) }, availability === 'available' && !scopeTooLarge, presentation === 'preview')
  const input = useRef<HTMLTextAreaElement>(null)
  if (availability !== 'available') return <SitePromptAccessActions availability={availability} destination={`/sites/${siteId}${area ? `?category=${area}` : ''}`} label={flagIds ? C.fixSelected(flagIds.length) : C.fixAll} />
  async function copy() {
    if (scopeTooLarge) return
    await submit(async () => {
      const bundle = await prepared.forCopy()
      if (!await copyRepairPrompt({ kind: 'bundle', siteId }, bundle)) { setManual(bundle.prompt); return }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    }, () => null)
  }
  return <>
    {presentation === 'preview' ? <div className="w-full"><FixPromptCard unavailable={scopeNotice ?? prepared.unavailable} prompt={prepared.preview} busy={busy} disabled={scopeTooLarge} copied={copied} copyLabel={flagIds ? C.fixSelected(flagIds.length) : C.fixAll} onCopy={() => void copy()} onExpand={() => { if (!scopeTooLarge && !prepared.preview) void submit(() => prepared.prepare(), () => null) }} /><SiteActionFeedback message={null} error={error} siteId={siteId} /></div> : <span className="inline-flex flex-col items-start gap-2">
      <span className="inline-flex flex-wrap items-center gap-1"><Button size="sm" variant={area ? 'outline' : 'default'} disabled={busy || scopeTooLarge} onClick={() => void copy()} title={C.bundleBody}>
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}{busy ? C.bundlePreparing : copied ? C.bundleCopied : flagIds ? C.fixSelected(flagIds.length) : area ? C.fixCategory : C.fixAll}
      </Button>
      <PromptPreviewButton key={`${siteId}:${area ?? 'all'}`} disabled={busy || scopeTooLarge} loadPrompt={async () => {
        const bundle = await prepared.prepare()
        return bundle.prompt
      }} /></span>
      <SiteActionFeedback message={scopeNotice} error={error} siteId={siteId} />
    </span>}
    <PromptPreviewDialog prompt={prepared.review ?? ''} open={prepared.review !== null} onOpenChange={open => { if (!open) prepared.closeReview() }} />
    <Dialog open={Boolean(manual)} onOpenChange={open => { if (!open) setManual(null) }}>
      <DialogContent header={<DialogTitle>{C.bundleManual}</DialogTitle>}>
        <DialogDescription>{C.bundleBody}</DialogDescription>
        <Textarea ref={input} value={manual ?? ''} readOnly rows={14} aria-label={SITE_BOARD_COPY.fixPromptLabel} onFocus={event => event.currentTarget.select()} />
        <Button variant="outline" onClick={() => { input.current?.focus(); input.current?.select() }}>{SITE_BOARD_COPY.selectPrompt}</Button>
      </DialogContent>
    </Dialog>
  </>
}
