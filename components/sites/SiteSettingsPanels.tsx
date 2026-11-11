'use client'

import { InteractiveSelect } from '@/components/ui/interactive-controls'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Bell, ChevronDown, ClipboardCheck, Clock3, Rocket, UserRound, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SiteSettingsSection } from './SiteSettingsSection'
import { SITE_SETTINGS_COPY as S } from '@/lib/marketing/copy/site-settings'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy-barrel'
import { MONITORING_SCHEDULE_COPY as M } from '@/lib/marketing/copy/monitoring'
import { ACCOUNT_CHECK_COPY as A } from '@/lib/marketing/copy/account-checks'
import type { AccountChecksView } from '@/lib/sites/accounts/contracts'
import type { OutcomeFixtureView } from '@/lib/sites/application/outcome-fixtures'
import { SafeFormFixtures } from './SafeFormFixtures'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import styles from './SiteSettingsPanels.module.css'

export type NotificationLevel = 'FLAGS' | 'CRITICAL_ONLY' | 'OFF'

function PanelHeading({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className={styles.heading}><span className={styles.icon}><Icon size={18} aria-hidden /></span><div><h2>{title}</h2><p>{description}</p></div></div>
}

export function SiteMonitoringSettingsPanel({ label, paused, scheduled, nextCheck, lastCheck, lastError, busy = false, onEdit, onPause, notice, editor }: {
  label: string; paused: boolean; scheduled: boolean; nextCheck?: string | null; lastCheck?: string | null;
  lastError?: string | null; busy?: boolean; onEdit: () => void; onPause: (paused: boolean) => void;
  notice?: ReactNode; editor?: ReactNode;
}) {
  return <SiteSettingsSection id="watch" tabIndex={-1}>
    <PanelHeading icon={Clock3} title={S.monitoring} description={S.monitoringBody} />
    <div className={styles.schedule}><span className={styles.scheduleLabel}><i data-active={scheduled && !paused} aria-hidden />{paused ? S.paused : label}</span>
      <div className={styles.actions}><Button variant="outline" disabled={busy} onClick={onEdit}>{M.edit}</Button>
        {scheduled ? <Button variant="ghost" disabled={busy} onClick={() => onPause(!paused)}>{paused ? S.resume : S.pause}</Button> : null}</div>
    </div>
    {(nextCheck && !paused) || lastCheck ? <dl className={styles.facts}>
      {nextCheck && !paused ? <div><dt>{S.next}</dt><dd>{nextCheck}</dd></div> : null}
      {lastCheck ? <div><dt>{S.last}</dt><dd>{lastCheck}</dd></div> : null}
    </dl> : null}
    {lastError ? <p className={styles.note}>{lastError}</p> : null}
    {notice}{editor}
    {/* The fine print comes after the controls it explains. */}
    <details className={styles.details}><summary>{S.monitoringDetails}<ChevronDown size={14} aria-hidden /></summary><p>{S.monitoringScope}</p></details>
  </SiteSettingsSection>
}

export function SiteNotificationSettingsPanel({ level, recovery, busy = false, onChange }: {
  level: NotificationLevel | null; recovery: boolean | null; busy?: boolean;
  onChange: (level: NotificationLevel, recovery: boolean) => void;
}) {
  const id = useId()
  return <SiteSettingsSection id="notifications">
    <PanelHeading icon={Bell} title={S.notifications} description={S.notificationsBody} />
    {level == null || recovery == null ? <p className={styles.note}>{SITE_BOARD_COPY.notificationsUnavailable}</p> : <>
      <div className={styles.field}><label htmlFor={id}>{S.emailMe}</label><InteractiveSelect id={id} value={level} disabled={busy} onChange={event => onChange(event.target.value as NotificationLevel, recovery)}>
        <option value="FLAGS">{S.levels.FLAGS}</option><option value="CRITICAL_ONLY">{S.levels.CRITICAL_ONLY}</option><option value="OFF">{S.levels.OFF}</option>
      </InteractiveSelect></div>
      <label className={styles.toggle}><Checkbox checked={recovery} disabled={busy || level === 'OFF'} onCheckedChange={checked => onChange(level, checked === true)} /><span>{S.recovery}</span></label>
      <p className={styles.saveHint}>{level === 'OFF' ? S.recoveryDisabled : S.automaticSave}</p>
    </>}
    <details className={styles.details}><summary>{S.notificationDetails}<ChevronDown size={14} aria-hidden /></summary><p>{S.notificationPolicy}</p></details>
  </SiteSettingsSection>
}

export function SiteAccountChecksPanel({ initial, enabled, busy = false, onToggle, onRequest, feedback }: {
  initial?: AccountChecksView; enabled: boolean; busy?: boolean; onToggle: (enabled: boolean) => void;
  onRequest: (mode: 'retest' | 'cleanup') => void; feedback?: ReactNode;
}) {
  return <SiteSettingsSection id="account-checks">
    <PanelHeading icon={UserRound} title={A.title} description={A.body} />
    <label className={styles.toggle}><Checkbox role="switch" checked={enabled} disabled={busy || !initial?.eligible} onCheckedChange={checked => onToggle(checked === true)} /><span>{A.enabled}</span></label>
    <details className={styles.details}><summary>{S.accountDetails}<ChevronDown size={14} aria-hidden /></summary><p>{A.email} {A.retention}</p></details>
    {initial?.reason ? <p className={styles.note}>{initial.reason}</p> : null}
    {initial?.accounts.length ? <dl className={styles.facts}>{initial.accounts.map(account => <div key={account.purpose}>
      <dt>{account.purpose === 'retained' ? A.retained : A.disposable}</dt><dd>{account.email}</dd><dd>{A.accountStates[account.state]}</dd>
    </div>)}</dl> : null}
    {initial?.results.length ? <ul className={styles.results}>{initial.results.map(item => <li key={item.kind + item.pageUrl}>
      <strong>{A.kinds[item.kind]}</strong><span data-state={item.state}>{A.states[item.state]}</span><p>{item.detail}</p><time dateTime={item.checkedAt}>{formatEvidenceTimestamp(item.checkedAt)}</time>
    </li>)}</ul> : <p className={styles.note}>{A.none}</p>}
    <div className={styles.actions}><Button variant="outline" disabled={busy || !enabled || !initial?.ready || !initial.eligible} onClick={() => onRequest('retest')}>{A.retest}</Button>
      <Button variant="ghost" disabled={busy || !initial?.canCleanup} onClick={() => onRequest('cleanup')}>{A.cleanup}</Button></div>
    {initial?.cleanupUnavailableReason ? <p className={styles.note}>{initial.cleanupUnavailableReason}</p> : null}
    {feedback}
  </SiteSettingsSection>
}

export function SiteRemovalSettingsPanel({ busy = false, onRemove }: { busy?: boolean; onRemove?: () => void }) {
  return <section className={styles.removal}><div><h2>{S.remove}</h2><p>{S.removeBody}</p></div><Button variant="destructive" disabled={busy || !onRemove} onClick={onRemove}>{S.remove}</Button></section>
}

/** The deploy hook needs a key with Run checks permission; nothing else in the app links to keys. */
export function SiteDeployChecksPanel() {
  return <SiteSettingsSection id="deploy-checks">
    <PanelHeading icon={Rocket} title={S.deploy.title} description={S.deploy.body} />
    <div className={styles.actions}>
      <Button asChild variant="outline"><Link href="/settings/api-keys">{S.deploy.keys}</Link></Button>
      <Button asChild variant="ghost"><Link href="/docs/site-care#check-after-every-deploy">{S.deploy.guide}</Link></Button>
    </div>
  </SiteSettingsSection>
}

/** Signup verification with a synthetic, reversible test account the owner authorizes. */
export function SiteSignupSetupPanel({ siteId, fixtures }: { siteId: string; fixtures: OutcomeFixtureView[] }) {
  return <SiteSettingsSection id="signup-setup">
    <PanelHeading icon={ClipboardCheck} title={S.signupSetup} description={S.signupBody} />
    <SafeFormFixtures siteId={siteId} initial={fixtures} />
  </SiteSettingsSection>
}

export function SiteAdvancedSettings({ children }: { children: ReactNode }) {
  const disclosure = useRef<HTMLDetailsElement>(null)
  const [visited, setVisited] = useState(false)
  const [destination, setDestination] = useState<{ id: string } | null>(null)
  useEffect(() => {
    const reveal = (hash: string) => {
      if (!['#deploy-checks', '#signup-setup', '#account-checks', '#scan-access', '#research'].includes(hash) || !disclosure.current) return
      setVisited(true)
      setDestination({ id: hash.slice(1) })
      disclosure.current.open = true
    }
    const fromLocation = () => reveal(window.location.hash)
    const fromLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target && anchor.target !== '_self' || anchor.hasAttribute('download')) return
      const next = new URL(anchor.href, window.location.href)
      if (next.origin === window.location.origin && next.pathname === window.location.pathname && next.search === window.location.search) reveal(next.hash)
    }
    fromLocation()
    window.addEventListener('hashchange', fromLocation)
    document.addEventListener('click', fromLink, true)
    return () => { window.removeEventListener('hashchange', fromLocation); document.removeEventListener('click', fromLink, true) }
  }, [])
  useLayoutEffect(() => {
    if (!visited || !destination) return
    const target = disclosure.current?.querySelector<HTMLElement>(`#${destination.id}`)
    if (!target) return
    const frame = requestAnimationFrame(() => { target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'start' }) })
    return () => cancelAnimationFrame(frame)
  }, [visited, destination])
  return <details ref={disclosure} className={styles.advanced} onToggle={event => { if (event.currentTarget.open) setVisited(true) }}><summary><span><strong>{S.advanced}</strong><span>{S.advancedBody}</span></span><ChevronDown size={16} aria-hidden /></summary>{visited ? <div>{children}</div> : null}</details>
}
