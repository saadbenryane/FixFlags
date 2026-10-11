'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'
import { useSiteAction } from '@/hooks/useSiteAction'
import { executeSiteAction, SiteActionError } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SiteActionFeedback } from './SiteActionFeedback'

export function SiteFlagActions({ siteId, flagId, verifying = false }: { siteId: string; flagId: string; verifying?: boolean }) {
  const router = useRouter()
  const { busy, message, error, submit, clearFeedback } = useSiteAction()
  const [verificationRunning, setVerificationRunning] = useState(verifying)
  const [changeSummary, setChangeSummary] = useState('')
  const [verifyOpen, setVerifyOpen] = useState(false)
  const intent = useRef<{ flagId: string; key: string } | null>(null)

  useEffect(() => {
    setVerificationRunning(verifying)
  }, [verifying])

  useEffect(() => {
    if (!verificationRunning) return
    const timer = window.setInterval(() => router.refresh(), 4000)
    return () => window.clearInterval(timer)
  }, [router, verificationRunning])

  async function verify() {
    if (intent.current?.flagId !== flagId) intent.current = { flagId, key: `web:verify:${flagId}:${crypto.randomUUID()}` }
    const result = await submit(async () => {
      const body = await executeSiteAction(`/api/sites/${siteId}/flags/${flagId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': intent.current!.key,
        },
        body: JSON.stringify({ changeSummary: changeSummary.trim() }),
      }, 'flagVerify')
      if (body.siteId !== siteId || body.flagId !== flagId) throw new SiteActionError(SITE_ACTION_COPY.invalidResponse)
      return body
    }, () => {
      setVerificationRunning(true)
      setVerifyOpen(false)
      return SITE_BOARD_COPY.verificationStarted
    }, () => router.refresh())
    if (result.kind === 'saved' || result.kind === 'saved_refresh_pending') intent.current = null
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="[&>span]:w-full [&_button]:w-full"><SitePromptCopyButton siteId={siteId} flagId={flagId} /></div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{SITE_BOARD_COPY.fixStepBody}</p>
      </div>

      <div className="border-t border-border/80 pt-5">
        <p className="text-sm leading-relaxed text-muted-foreground">{SITE_BOARD_COPY.verifyStepBody}</p>
        <Button className="mt-3 w-full" variant="brand" disabled={busy || verificationRunning} onClick={() => { clearFeedback(); setVerifyOpen(true) }}>
          <ShieldCheck aria-hidden="true" />
          {verificationRunning ? SITE_BOARD_COPY.verifying : SITE_BOARD_COPY.verifyFix}
        </Button>
        {message && !verifyOpen ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
      </div>
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent>
          <DialogTitle>{SITE_BOARD_COPY.verifyFix}</DialogTitle>
          <DialogDescription>{SITE_BOARD_COPY.verifyDescription}</DialogDescription>
          <div className="space-y-1">
            <label htmlFor="flag-change-summary" className="text-sm font-medium">{SITE_BOARD_COPY.changeLabel}</label>
            <p id="flag-change-summary-hint" className="text-xs text-muted-foreground">{SITE_BOARD_COPY.changeHint}</p>
            <Textarea id="flag-change-summary" aria-describedby="flag-change-summary-hint" value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} rows={3} placeholder={SITE_BOARD_COPY.changePlaceholder} />
          </div>
          <SiteActionFeedback message={message} error={error} siteId={siteId} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setVerifyOpen(false)}>Cancel</Button>
            <Button type="button" variant="brand" disabled={busy} onClick={() => void verify()}>{busy ? SITE_BOARD_COPY.verifying : SITE_BOARD_COPY.verifyFix}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
