'use client'

import Link from 'next/link'
import type { RepairGuidanceState } from '@/lib/improvements/repair-guidance'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'
import type { SiteResourceUpdate } from '@/hooks/useSiteResource'
import { SiteResourceBoundary, useSharedSiteResource } from './SiteResourceBoundary'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { useSiteAction } from '@/hooks/useSiteAction'
import { executeSiteAction, SiteActionError } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SiteActionFeedback } from './SiteActionFeedback'
import styles from './SiteFlagActions.module.css'

type SiteFlagActionsProps = { siteId: string; flagId: string; initial: SiteHomeView; initialVerificationAuditId?: string | null; verifying?: boolean; repairGuidance: RepairGuidanceState; initialFix?: string; sourceAuditId?: string }

export function SiteFlagActions(props: SiteFlagActionsProps) {
  return <SiteResourceBoundary siteId={props.siteId} initial={props.initial}><SiteFlagActionsContent {...props} /></SiteResourceBoundary>
}

function SiteFlagActionsContent({ siteId, flagId, initialVerificationAuditId = null, verifying = false, repairGuidance, initialFix, sourceAuditId }: SiteFlagActionsProps) {
  const router = useRouter()
  const { busy, message, error, submit, clearFeedback, requestKey, completeIntent } = useSiteAction(`site:${siteId}`)
  const { view, refresh, disconnected } = useSharedSiteResource(siteId, refreshHistoricalGuidance)
  const currentFlag = [...view.flags, ...view.recommendations, ...view.resolvedFlags]
    .find(flag => (flag.sourceFlagId ?? flag.id) === flagId)
  const currentGuidance = currentFlag?.repairGuidance ?? repairGuidance
  const guidance = currentFlag?.fix ?? initialFix
  const [verificationAuditId, setVerificationAuditId] = useState(initialVerificationAuditId)
  const [verificationRunning, setVerificationRunning] = useState(verifying)
  const [changeSummary, setChangeSummary] = useState('')
  const [verifyOpen, setVerifyOpen] = useState(false)
  const intent = useRef<{ flagId: string; key: string } | null>(null)
  const guidanceActions = useRef<HTMLDivElement | null>(null)
  const guidanceRefreshRequested = useRef(false)
  const lastGuidancePublication = useRef<string | null>(null)
  function refreshHistoricalGuidance(update: SiteResourceUpdate) {
    if (currentFlag || !sourceAuditId || repairGuidance !== 'pending') return
    if (update.type === 'projection') {
      const { notice } = update
      if (notice.auditId !== sourceAuditId || notice.kind !== 'prescription' ||
        !['COMPLETED', 'BLOCKED', 'EXHAUSTED'].includes(notice.state)) return
      const publication = JSON.stringify(['historical', siteId, flagId, notice.taskId, notice.state, notice.observationReference])
      if (lastGuidancePublication.current === publication) return
      lastGuidancePublication.current = publication
    }
    // A notice requests a source read. It never establishes guidance readiness.
    router.refresh()
  }
  useEffect(() => { guidanceRefreshRequested.current = false; lastGuidancePublication.current = null }, [siteId, flagId])
  useEffect(() => {
    if (currentGuidance === 'pending' || !currentFlag ||
      currentGuidance === repairGuidance && (initialFix === undefined || currentFlag.fix === initialFix)) return
    const publication = JSON.stringify([siteId, flagId, currentGuidance, currentFlag.fix])
    if (lastGuidancePublication.current === publication) return
    lastGuidancePublication.current = publication
    // The live source enables actions immediately; refresh the server-rendered
    // explanation once without changing navigation or the customer's draft.
    router.refresh()
  }, [siteId, flagId, currentFlag, currentGuidance, repairGuidance, initialFix, router])
  useEffect(() => {
    if (!guidanceRefreshRequested.current || currentGuidance === 'pending') return
    guidanceRefreshRequested.current = false
    if (document.activeElement === document.body) guidanceActions.current?.querySelector<HTMLElement>('button:not(:disabled), a[href]')?.focus()
  }, [currentGuidance])


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
    <div className={styles.actions}>
      <ol className={styles.steps}>
        <li>
          <span className={styles.number} aria-hidden="true">1</span>
          <div ref={guidanceActions} className={styles.step}>
            <h3>{SITE_BOARD_COPY.fixStep}</h3>
            {currentGuidance === 'ready' ? <>
              <p className={styles.description}>{SITE_BOARD_COPY.fixStepBody}</p>
              <div className="[&>span]:w-full [&_button]:w-full"><SitePromptCopyButton siteId={siteId} flagId={flagId} /></div>
              {guidance?.trim() ? <details className={styles.guidance}>
                <summary>{SITE_BOARD_COPY.readFixGuidance}<ChevronDown size={14} aria-hidden /></summary>
                <p>{guidance}</p>
              </details> : null}
            </> : <div className="space-y-3">
              <p role="status" className="text-sm leading-relaxed text-muted-foreground">{SITE_ACTION_COPY.repairGuidance[currentGuidance]}</p>
              {currentGuidance === 'pending' ? <Button type="button" variant="outline" onClick={() => { guidanceRefreshRequested.current = true; router.refresh() }}>{SITE_ACTION_COPY.repairGuidance.refresh}</Button>
                : <Button variant="outline" asChild><Link href={`/sites/${siteId}`}>{SITE_ACTION_COPY.repairGuidance.overview}</Link></Button>}
            </div>}
          </div>
        </li>

        <li>
          <span className={styles.number} aria-hidden="true">2</span>
          <div className={styles.step}>
            <h3>{SITE_BOARD_COPY.verifyStep}</h3>
            <p className={styles.description}>{SITE_BOARD_COPY.verifyStepBody}</p>
            <Button className="w-full" variant="outline" disabled={busy || verificationRunning} onClick={() => { clearFeedback(); setVerifyOpen(true) }}>
              <ShieldCheck aria-hidden="true" />
              {verificationRunning ? SITE_BOARD_COPY.verifying : SITE_BOARD_COPY.verifyFix}
            </Button>
            {message && !verifyOpen ? (
              <p className="mt-3 text-sm text-muted-foreground" role="status" aria-live="polite">
                {message}
              </p>
            ) : null}
          </div>
        </li>
      </ol>
      {disconnected ? <p role="status" className="text-sm text-muted-foreground">{SITE_ACTION_COPY.updatesDisconnected}</p> : null}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent header={<DialogTitle>{SITE_BOARD_COPY.verifyFix}</DialogTitle>}>
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
