'use client'

import { SiteAccountChecksControls } from './SiteAccountChecksControls'
import { SiteMonitoringSettingsPanel, SiteNotificationSettingsPanel, SiteRemovalSettingsPanel, type NotificationLevel } from './SiteSettingsPanels'
import { useEffect, useState, useRef } from 'react'
import { SiteRemovalDialog } from './SiteRemovalDialog'
import { ACCOUNT_CHECK_COPY as A } from '@/lib/marketing/copy/account-checks'
import type { AccountChecksView } from '@/lib/sites/accounts/contracts'
import { SiteMonitoringSchedule } from './SiteMonitoringSchedule'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { WATCH_ALERT_DELIVERY } from '@/lib/marketing/copy'
import type { SiteHomeView } from '@/lib/sites/application/queries'
import { formatAlertDate, siteWatchAlertNotice } from '@/lib/sites/watch-alert-notice'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { executeSiteAction } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { useSiteAction } from '@/hooks/useSiteAction'
import { SiteActionFeedback } from './SiteActionFeedback'

export function SiteSettingsControls({
  siteId,
  watch,
  initial,
}: {
  siteId: string
  watch: SiteHomeView['watch']
  initial: SiteHomeView['settings']
}) {
  const router = useRouter()
  const [level, setLevel] = useState<NotificationLevel | null>(initial.notificationLevel)
  const [recovery, setRecovery] = useState<boolean | null>(initial.notifyOnRecovery)
  const { busy, message, error, submit, requestKey, completeIntent } = useSiteAction(`site:${siteId}:settings`)
  const [removalOpen, setRemovalOpen] = useState(false)
  const removalOpener = useRef<HTMLElement | null>(null)
  const [paused, setPaused] = useState(watch.state === 'paused')
  useEffect(() => {
    const hash = window.location.hash
    if (hash === '#connections' || hash.startsWith('#connection-')) router.replace(`/sites/${siteId}?view=integrations${hash}`)
    if (hash === '#signup-setup') document.getElementById('account-checks')?.scrollIntoView()
  }, [router, siteId])
  useEffect(() => { setPaused(watch.state === 'paused') }, [watch.state])
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const alertNotice = watch.alert ? siteWatchAlertNotice(watch.alert) : null
  async function saveNotifications(nextLevel = level, nextRecovery = recovery) {
    if (!nextLevel || nextRecovery == null) return
    await submit(() => executeSiteAction(`/api/sites/${siteId}/settings`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationLevel: nextLevel, notifyOnRecovery: nextRecovery }),
    }, 'settings'), () => { setLevel(nextLevel); setRecovery(nextRecovery); return C.settings.notificationsSaved }, () => router.refresh())
  }

  async function setMonitoringPaused(value: boolean) {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/watch`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: value ? 'pause' : 'resume' }) }, 'acknowledgement'),
      () => { setPaused(value); return value ? C.settings.monitoringPaused : C.settings.monitoringResumed }, () => router.refresh())
  }

  async function cleanupAccounts() {
    await submit(() => executeSiteAction(`/api/sites/${siteId}/account-checks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey('cleanup') },
      body: JSON.stringify({ action: 'cleanup' }),
    }, 'run'), () => { completeIntent('cleanup'); return A.requested }, () => router.refresh())
  }
  async function removeSite(remaining: AccountChecksView['accounts']) {
    const result = await submit(() => executeSiteAction(`/api/sites/${siteId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(remaining.length ? { acknowledgeRemainingAccounts: true,
        remainingAccounts: remaining.map(({ email, state }) => ({ email, state })) } : {}),
    }, 'acknowledgement'), () => { router.push('/dashboard'); return null }, () => router.refresh())
    if (result.kind === 'refused') { setRemovalOpen(false); router.refresh() }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <SiteMonitoringSettingsPanel label={watch.label} paused={paused} scheduled={Boolean(watch.interval)}
        nextCheck={watch.nextRunAt ? formatEvidenceTimestamp(watch.nextRunAt) : null}
        lastCheck={watch.lastRunAt ? formatEvidenceTimestamp(watch.lastRunAt) : null}
        lastError={watch.lastError} busy={busy} onEdit={() => setScheduleOpen(true)} onPause={value => void setMonitoringPaused(value)}
        notice={alertNotice ? <div className="mt-3"><Callout variant="warning">
          <p className="font-medium">{alertNotice.title}</p><p className="mt-1">{WATCH_ALERT_DELIVERY.undeliveredBody(formatAlertDate(alertNotice.at))}</p>
          <Button asChild size="sm" variant="outline" className="mt-2"><Link href={alertNotice.actionHref as Route}>{alertNotice.actionLabel}</Link></Button>
        </Callout></div> : null}
        editor={scheduleOpen ? <SiteMonitoringSchedule siteId={siteId} interval={watch.interval} everyMinutes={watch.everyMinutes} onClose={() => setScheduleOpen(false)} onRefresh={async () => { router.refresh() }} /> : null}
      />
      <SiteNotificationSettingsPanel level={level} recovery={recovery} busy={busy} onChange={(nextLevel, nextRecovery) => void saveNotifications(nextLevel, nextRecovery)} />

      <SiteAccountChecksControls siteId={siteId} initial={initial.accountChecks} />
      {busy ? <p role="status" className="text-sm">{C.settings.saving}</p> : null}
      <SiteActionFeedback message={message} error={error} siteId={siteId} />
      <SiteRemovalSettingsPanel busy={busy} onRemove={() => { removalOpener.current = document.activeElement as HTMLElement; setRemovalOpen(true) }} />
      <SiteRemovalDialog open={removalOpen} onOpenChange={setRemovalOpen} accounts={initial.accountChecks} busy={busy}
        onCleanup={() => void cleanupAccounts()} onRemove={remaining => void removeSite(remaining)}
        onCloseAutoFocus={event => { event.preventDefault(); removalOpener.current?.focus() }} />
    </div>
  )
}
