'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { SitesOverviewGrid } from '@/components/sites/SitesOverviewGrid'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import { useSiteSummaries } from '@/hooks/useSiteSummaries'
import type { SiteSummary } from '@/lib/sites/application/list-sites'
import { SCAN_HANDOFF, WEBSITES_COPY as C } from '@/lib/marketing/copy-barrel'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import styles from './WebsitesDashboard.module.css'

type RetryFocus = { owner: object; button: HTMLButtonElement; restore: boolean }

export function WebsitesDashboard({ initialSites, ownerId, readAt, resumedUrl }: {
  initialSites: SiteSummary[]; ownerId: string; readAt: number; resumedUrl: string | null;
}) {
  const { user, isLoading: accountLoading, refresh: refreshUser } = useMe()
  const initial = useMemo(() => ({ ownerId, sites: initialSites, readAt }), [ownerId, initialSites, readAt])
  const { sites, failed, accountChanged, authRequired, refreshing, refresh } = useSiteSummaries(user?.id ?? null, initial)
  const dashboard = useRef<HTMLDivElement>(null)
  const retryOwner = useMemo(() => ({ id: user?.id }), [user?.id])
  const retryFocus = useRef<RetryFocus | null>(null)
  const [completedRetry, setCompletedRetry] = useState<RetryFocus | null>(null)
  useLayoutEffect(() => () => { retryFocus.current = null }, [retryOwner])
  useLayoutEffect(() => {
    if (!completedRetry || retryFocus.current !== completedRetry) return
    retryFocus.current = null
    if (completedRetry.owner !== retryOwner || !completedRetry.restore ||
      document.activeElement !== document.body && document.activeElement !== completedRetry.button) return
    let target: HTMLElement | null | undefined
    if (failed) target = completedRetry.button.isConnected ? completedRetry.button : null
    else if (!authRequired && !accountChanged) target = dashboard.current?.querySelector<HTMLElement>('#sites-heading') ?? dashboard.current?.querySelector<HTMLElement>('#analyze-heading')
    target?.focus()
  }, [completedRetry, retryOwner, sites, failed, authRequired, accountChanged])
  const sessionRead = useRef<string | null>(null)
  const sessionKey = user && (accountChanged || authRequired) ? `${user.id}:${accountChanged ? 'changed' : 'expired'}` : null
  const refreshAccount = useCallback(async () => {
    const current = await refreshUser()
    // A different account gets its own read automatically. An unchanged account
    // needs a new summary read to retire the earlier identity discrepancy.
    if (current?.user?.id === user?.id) await refresh()
  }, [refreshUser, user?.id, refresh])
  useEffect(() => {
    if (!sessionKey) { sessionRead.current = null; return }
    if (sessionRead.current === sessionKey) return
    sessionRead.current = sessionKey
    void refreshAccount()
  }, [sessionKey, refreshAccount])
  async function retry(button: HTMLButtonElement) {
    const request = { owner: retryOwner, button, restore: document.activeElement === button }
    retryFocus.current = request
    try { if (accountChanged) await refreshAccount(); else await refresh() }
    catch { /* The current dashboard read owns its recovery message. */ }
    finally { if (retryFocus.current === request) setCompletedRetry(request) }
  }
  const feedback = authRequired ? <div role="status" className="space-y-3"><p>{SITE_ACTION_COPY.signIn}</p><Button asChild variant="outline"><Link href="/sign-in?next=%2Fdashboard">{SITE_ACTION_COPY.signInAction}</Link></Button></div>
    : failed ? <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><p>{accountChanged ? C.accountChanged : sites === null ? C.refreshFailed : C.refreshFailedRetained}</p><Button variant="outline" size="sm" loading={refreshing || accountLoading} onClick={event => void retry(event.currentTarget)}>{SITE_ACTION_COPY.retryResults}</Button></div> : null
  if (sites === null) return feedback ?? <p role="status" className="text-sm text-muted-foreground">{C.loading}</p>
  const firstWebsite = sites.length === 0
  const handoff = user?.id === ownerId ? resumedUrl : null
  return <div ref={dashboard} key={user?.id} className="space-y-6">
    {feedback}
    <SitesOverviewGrid sites={sites} action={<Button asChild variant="outline" size="sm"><a href="#analyze-heading"><Plus aria-hidden />{C.analyzeTitle}</a></Button>} />
    <section aria-labelledby="analyze-heading" className={styles.entry} data-first={firstWebsite}>
      <h2 id="analyze-heading" tabIndex={-1} className={`${styles.title} scroll-mt-24 rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}>{firstWebsite ? C.firstTitle : C.analyzeTitle}</h2>
      <p className={styles.description}>{handoff ? SCAN_HANDOFF.resuming(handoff) : C.analyzeBody}</p>
      <AuditInput idSuffix="-dashboard" source="dashboard" initialUrl={handoff ?? undefined} autoStart={Boolean(handoff)} />
      {firstWebsite && !handoff ? <ol className={styles.steps}>{C.firstSteps.map((step, index) => <li key={step.title}>
        <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
        <div><h3>{step.title}</h3><p>{step.body}</p></div>
      </li>)}</ol> : null}
    </section>
  </div>
}
