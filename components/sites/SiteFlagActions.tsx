'use client'

import Link from 'next/link'
import type { RepairGuidanceState } from '@/lib/improvements/repair-guidance'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'
import { useSiteResource } from '@/hooks/useSiteResource'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { useSiteAction } from '@/hooks/useSiteAction'
import { executeSiteAction, SiteActionError } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SiteActionFeedback } from './SiteActionFeedback'

export function SiteFlagActions({ siteId, flagId, initial, initialVerificationAuditId = null, verifying = false, repairGuidance }: { siteId: string; flagId: string; initial: SiteHomeView; initialVerificationAuditId?: string | null; verifying?: boolean; repairGuidance: RepairGuidanceState }) {
  const router = useRouter()
  const { busy, message, error, submit, clearFeedback, requestKey, completeIntent } = useSiteAction(`site:${siteId}`)
  const { view, refresh, disconnected } = useSiteResource(siteId, initial)
  const [verificationAuditId, setVerificationAuditId] = useState(initialVerificationAuditId)
  const [verificationRunning, setVerificationRunning] = useState(verifying)
  const [changeSummary, setChangeSummary] = useState('')
  const [verifyOpen, setVerifyOpen] = useState(false)
  const intent = useRef<{ flagId: string; key: string } | null>(null)
  const guidanceActions = useRef<HTMLDivElement | null>(null)
  const guidanceRefreshRequested = useRef(false)
  useEffect(() => { guidanceRefreshRequested.current = false }, [siteId, flagId])
  useEffect(() => {
    if (!guidanceRefreshRequested.current || repairGuidance === 'pending') return
    guidanceRefreshRequested.current = false
    if (document.activeElement === document.body) guidanceActions.current?.querySelector<HTMLElement>('button:not(:disabled), a[href]')?.focus()
  }, [repairGuidance])


  useEffect(() => {
    setVerificationRunning(verifying)
  }, [verifying])

  useEffect(() => {
    if (!verificationAuditId || !view.monitoringHistory.some(entry => entry.id === verificationAuditId)) return
    setVerificationRunning(false); setVerificationAuditId(null); router.refresh()
  }, [verificationAuditId, view.monitoringHistory, router])

  async function verify() {
    if (intent.current?.flagId !== flagId) intent.current = { flagId, key: requestKey(`flag:${flagId}`) }
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
    }, body => {
      setVerificationAuditId(body.verificationAuditId)
      setVerificationRunning(true)
      setVerifyOpen(false)
      return SITE_BOARD_COPY.verificationStarted
    }, async () => { await refresh(); router.refresh() })
    if (result.kind === 'saved' || result.kind === 'saved_refresh_pending') { completeIntent(`flag:${flagId}`); intent.current = null }
  }

  return (
    <div className="space-y-6">
      <div ref={guidanceActions}>
        <h3 className="mb-3 text-sm font-semibold">{SITE_BOARD_COPY.fixStep}</h3>
        {repairGuidance === 'ready' ? <>
          <div className="[&>span]:w-full [&_button]:w-full"><SitePromptCopyButton siteId={siteId} flagId={flagId} /></div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{SITE_BOARD_COPY.fixStepBody}</p>
        </> : <div className="space-y-3">
          <p role="status" className="text-sm leading-relaxed text-muted-foreground">{SITE_ACTION_COPY.repairGuidance[repairGuidance]}</p>
          {repairGuidance === 'pending' ? <Button type="button" variant="outline" onClick={() => { guidanceRefreshRequested.current = true; router.refresh() }}>{SITE_ACTION_COPY.repairGuidance.refresh}</Button>
            : <Button variant="outline" asChild><Link href={`/sites/${siteId}`}>{SITE_ACTION_COPY.repairGuidance.overview}</Link></Button>}
        </div>}
      </div>

      <div className="pt-5">
        <h3 className="mb-3 text-sm font-semibold">{SITE_BOARD_COPY.verifyStep}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{SITE_BOARD_COPY.verifyStepBody}</p>
        <Button className="mt-3 w-full" variant="default" disabled={busy || verificationRunning} onClick={() => { clearFeedback(); setVerifyOpen(true) }}>
          <ShieldCheck aria-hidden="true" />
          {verificationRunning ? SITE_BOARD_COPY.verifying : SITE_BOARD_COPY.verifyFix}
        </Button>
        {message && !verifyOpen ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
      </div>
      {disconnected ? <p role="status" className="text-sm text-muted-foreground">{SITE_ACTION_COPY.updatesDisconnected}</p> : null}
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
            <Button type="button" variant="ghost" onClick={() => setVerifyOpen(false)}>{SITE_ACTION_COPY.cancel}</Button>
            <Button type="button" variant="default" disabled={busy} onClick={() => void verify()}>{busy ? SITE_BOARD_COPY.verifying : SITE_BOARD_COPY.verifyFix}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
