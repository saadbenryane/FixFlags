'use client'

import { InteractiveSelect } from '@/components/ui/interactive-controls'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Bell, ChevronDown, Clock3, UserRound, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SiteSettingsSection } from './SiteSettingsSection'
import { SITE_SETTINGS_COPY as S } from '@/lib/marketing/copy/site-settings'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy-barrel'
import { MONITORING_SCHEDULE_COPY as M } from '@/lib/marketing/copy/monitoring'
import { ACCOUNT_CHECK_COPY as A } from '@/lib/marketing/copy/account-checks'
import type { AccountChecksView } from '@/lib/sites/accounts/contracts'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import styles from './SiteSettingsPanels.module.css'

export type NotificationLevel = 'FLAGS' | 'CRITICAL_ONLY' | 'OFF'

function PanelHeading({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className={styles.heading}><span className={styles.icon}><Icon size={18} aria-hidden /></span><div><h2>{title}</h2><p>{description}</p></div></div>
}

export function SiteMonitoringSettingsPanel({ label, target, paused, scheduled, nextCheck, lastCheck, lastError, busy = false, onEdit, onPause, notice, editor }: {
  label: string; target?: string; paused: boolean; scheduled: boolean; nextCheck?: string | null; lastCheck?: string | null;
  lastError?: string | null; busy?: boolean; onEdit: () => void; onPause: (paused: boolean) => void;
  notice?: ReactNode; editor?: ReactNode;
}) {
  return <SiteSettingsSection id="watch" tabIndex={-1}>
    <PanelHeading icon={Clock3} title={S.monitoring} description={S.monitoringBody} />
    <details className={styles.details}><summary>{S.monitoringDetails}<ChevronDown size={14} aria-hidden /></summary><p>{S.monitoringScope}</p></details>
    {target ? <p className={styles.note}>{S.target}: <span className="break-all">{target}</span></p> : null}
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
  </SiteSettingsSection>
}

export function SiteNotificationSettingsPanel({ level, recovery, busy = false, onChange }: {
  level: NotificationLevel | null; recovery: boolean | null; busy?: boolean;
  onChange: (level: NotificationLevel, recovery: boolean) => void;
}) {
  const id = useId()
  return <SiteSettingsSection id="notifications">
    <PanelHeading icon={Bell} title={S.notifications} description={S.notificationsBody} />
    <details className={styles.details}><summary>{S.notificationDetails}<ChevronDown size={14} aria-hidden /></summary><p>{S.notificationPolicy}</p></details>
    {level == null || recovery == null ? <p className={styles.note}>{SITE_BOARD_COPY.notificationsUnavailable}</p> : <>
      <div className={styles.field}><label htmlFor={id}>{S.emailMe}</label><InteractiveSelect id={id} value={level} disabled={busy} onChange={event => onChange(event.target.value as NotificationLevel, recovery)}>
        <option value="FLAGS">{S.levels.FLAGS}</option><option value="CRITICAL_ONLY">{S.levels.CRITICAL_ONLY}</option><option value="OFF">{S.levels.OFF}</option>
      </InteractiveSelect></div>
      <label className={styles.toggle}><Checkbox checked={recovery} disabled={busy || level === 'OFF'} onCheckedChange={checked => onChange(level, checked === true)} /><span>{S.recovery}</span></label>
      <p className={styles.saveHint}>{level === 'OFF' ? S.recoveryDisabled : S.automaticSave}</p>
    </>}
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

export function SiteAdvancedSettings({ children }: { children: ReactNode }) {
  const disclosure = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    let frame: number | null = null
    const reveal = () => {
      const hash = window.location.hash
      if (!['#signup-setup', '#account-checks', '#scan-access', '#research'].includes(hash) || !disclosure.current) return
      disclosure.current.open = true
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => document.getElementById(hash === '#signup-setup' ? 'account-checks' : hash.slice(1))?.scrollIntoView({ block: 'start' }))
    }
    reveal()
    window.addEventListener('hashchange', reveal)
    return () => { window.removeEventListener('hashchange', reveal); if (frame !== null) cancelAnimationFrame(frame) }
  }, [])
  return <details ref={disclosure} className={styles.advanced}><summary><span><strong>{S.advanced}</strong><span>{S.advancedBody}</span></span><ChevronDown size={16} aria-hidden /></summary><div>{children}</div></details>
}
